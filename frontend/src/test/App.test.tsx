import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { setSession } from '../auth/session'
import { trackEvent, trackException, trackPageView } from '../telemetry'

vi.mock('../telemetry', () => ({
  trackEvent: vi.fn(),
  trackException: vi.fn(),
  trackPageView: vi.fn(),
}))

const unreachableMessage =
  "Can't reach ScaffoldTest right now. It may be updating, so try again in a minute."

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString()
      return handler(url, init)
    })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// fetch rejects like this when the API can't be reached at all.
function unreachable(): Promise<Response> {
  throw new TypeError('Failed to fetch')
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
  })
}

// Signed in, since the app only shows the sign-in page otherwise. auth.test.tsx covers signing in and out.
beforeEach(() => {
  setSession({ token: 'test:Tester', name: 'Tester', provider: 'test' })
})

afterEach(() => {
  // Signing out re-renders the app if a test left it mounted.
  act(() => setSession(null))
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('App', () => {
  describe('static content', () => {
    it('renders heading and subtitle', async () => {
      mockFetch(async () => jsonResponse([]))

      renderAt('/')

      expect(
        screen.getByRole('heading', { level: 1, name: 'ScaffoldTest' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText('A throwaway app for testing the scaffold.'),
      ).toBeInTheDocument()
      await waitForLoaded()
    })

    it('links the logo to the projects page', async () => {
      mockFetch(async () => jsonResponse([]))

      renderAt('/')

      expect(
        screen.getByRole('link', { name: 'ScaffoldTest' }),
      ).toHaveAttribute('href', '/')
      await waitForLoaded()
    })

    it('tracks a page view', async () => {
      mockFetch(async () => jsonResponse([]))

      renderAt('/')

      expect(trackPageView).toHaveBeenCalledTimes(1)
      await waitForLoaded()
    })

    it('shows the not found page for an unknown address', () => {
      mockFetch(async () => jsonResponse([]))

      renderAt('/nowhere')

      expect(
        screen.getByRole('heading', { name: 'Page not found' }),
      ).toBeInTheDocument()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('projects page', () => {
    it('shows loading state then displays projects as links', async () => {
      mockFetch(async () =>
        jsonResponse([
          { id: 1, name: 'Website Redesign' },
          { id: 2, name: 'Sump survey' },
        ]),
      )

      renderAt('/')

      expect(screen.getByLabelText('Loading')).toBeInTheDocument()

      await waitFor(() => {
        expect(
          screen.getByRole('link', { name: 'Website Redesign' }),
        ).toHaveAttribute('href', '/projects/1')
      })
      expect(screen.getByRole('link', { name: 'Sump survey' })).toHaveAttribute(
        'href',
        '/projects/2',
      )
      expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
    })

    it('shows "No projects yet." when the list is empty', async () => {
      mockFetch(async () => jsonResponse([]))

      renderAt('/')

      await waitFor(() => {
        expect(screen.getByText('No projects yet.')).toBeInTheDocument()
      })
    })

    it('shows error message when loading fails', async () => {
      mockFetch(async () => new Response(null, { status: 500 }))

      renderAt('/')

      await waitFor(() => {
        expect(screen.getByText('Unable to load projects.')).toBeInTheDocument()
      })
      expect(trackException).toHaveBeenCalledTimes(1)
    })

    it('shows error message when the API is unreachable', async () => {
      mockFetch(unreachable)

      renderAt('/')

      await waitFor(() => {
        expect(screen.getByText(unreachableMessage)).toBeInTheDocument()
      })
    })

    it('creates a project and reloads the list', async () => {
      const user = userEvent.setup()
      const projects = [{ id: 1, name: 'Website Redesign' }]
      const fetchMock = mockFetch(async (_url, init) => {
        if (init?.method === 'POST') {
          projects.push({ id: 2, name: 'Sump survey' })
          return jsonResponse(projects[1], 201)
        }
        return jsonResponse(projects)
      })

      renderAt('/')
      await waitForLoaded()

      await user.type(screen.getByLabelText(/Project name/), '  Sump survey  ')
      await user.click(screen.getByRole('button', { name: 'Create project' }))

      await waitFor(() => {
        expect(
          screen.getByRole('link', { name: 'Sump survey' }),
        ).toBeInTheDocument()
      })
      const post = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'POST',
      )
      expect(post?.[1]?.body).toBe(JSON.stringify({ name: 'Sump survey' }))
      expect(screen.getByLabelText(/Project name/)).toHaveValue('')
      expect(trackEvent).toHaveBeenCalledWith('ProjectCreated')
    })

    it('asks for a name when it is only spaces', async () => {
      const user = userEvent.setup()
      mockFetch(async () => jsonResponse([]))

      renderAt('/')
      await waitForLoaded()

      await user.type(screen.getByLabelText(/Project name/), '   ')
      await user.click(screen.getByRole('button', { name: 'Create project' }))

      expect(screen.getByText('Project name is required.')).toBeInTheDocument()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it("shows the API's message for a duplicate name without reporting it", async () => {
      const user = userEvent.setup()
      mockFetch(async (_url, init) =>
        init?.method === 'POST'
          ? jsonResponse(
              { message: 'A project with this name already exists.' },
              409,
            )
          : jsonResponse([{ id: 1, name: 'Website Redesign' }]),
      )

      renderAt('/')
      await waitForLoaded()

      await user.type(screen.getByLabelText(/Project name/), 'website redesign')
      await user.click(screen.getByRole('button', { name: 'Create project' }))

      await waitFor(() => {
        expect(
          screen.getByText('A project with this name already exists.'),
        ).toBeInTheDocument()
      })
      expect(trackException).not.toHaveBeenCalled()
      expect(screen.getByLabelText(/Project name/)).toHaveValue(
        'website redesign',
      )
    })

    it('shows error message when saving fails', async () => {
      const user = userEvent.setup()
      mockFetch(async (_url, init) =>
        init?.method === 'POST'
          ? new Response(null, { status: 500 })
          : jsonResponse([]),
      )

      renderAt('/')
      await waitForLoaded()

      await user.type(screen.getByLabelText(/Project name/), 'Website Redesign')
      await user.click(screen.getByRole('button', { name: 'Create project' }))

      await waitFor(() => {
        expect(screen.getByText('Unable to save project.')).toBeInTheDocument()
      })
      expect(trackException).toHaveBeenCalledTimes(1)
    })
  })

  describe('project page', () => {
    it('shows the project with its name ready to edit', async () => {
      mockFetch(async () => jsonResponse({ id: 7, name: 'Website Redesign' }))

      renderAt('/projects/7')

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Website Redesign' }),
        ).toBeInTheDocument()
      })
      expect(screen.getByLabelText(/Project name/)).toHaveValue(
        'Website Redesign',
      )
      expect(
        screen.getByRole('link', { name: '← Back to projects' }),
      ).toHaveAttribute('href', '/')
    })

    it("shows the not found page when the project doesn't exist", async () => {
      mockFetch(async () => new Response(null, { status: 404 }))

      renderAt('/projects/7')

      await waitFor(() => {
        expect(
          screen.getByText(
            "That project doesn't exist. It may have been deleted.",
          ),
        ).toBeInTheDocument()
      })
    })

    it.each(['abc', '0', '-1', '1.5'])(
      'shows the not found page for the id %j without calling the API',
      (id) => {
        mockFetch(async () => jsonResponse({}))

        renderAt(`/projects/${id}`)

        expect(
          screen.getByRole('heading', { name: 'Page not found' }),
        ).toBeInTheDocument()
        expect(fetch).not.toHaveBeenCalled()
      },
    )

    it('shows error message when the API is unreachable', async () => {
      mockFetch(unreachable)

      renderAt('/projects/7')

      await waitFor(() => {
        expect(screen.getByText(unreachableMessage)).toBeInTheDocument()
      })
    })

    it('renames the project', async () => {
      const user = userEvent.setup()
      const fetchMock = mockFetch(async (_url, init) =>
        init?.method === 'PUT'
          ? jsonResponse({ id: 7, name: 'Website Redesign 2026' })
          : jsonResponse({ id: 7, name: 'Website Redesign' }),
      )

      renderAt('/projects/7')
      const input = await screen.findByLabelText(/Project name/)

      await user.clear(input)
      await user.type(input, ' Website Redesign 2026 ')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Website Redesign 2026' }),
        ).toBeInTheDocument()
      })
      const put = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'PUT',
      )
      expect(put?.[0]).toMatch(/\/api\/projects\/7$/)
      expect(put?.[1]?.body).toBe(
        JSON.stringify({ name: 'Website Redesign 2026' }),
      )
      expect(trackEvent).toHaveBeenCalledWith('ProjectUpdated')
    })

    it("shows the API's message when renaming to a name already in use", async () => {
      const user = userEvent.setup()
      mockFetch(async (_url, init) =>
        init?.method === 'PUT'
          ? jsonResponse(
              { message: 'A project with this name already exists.' },
              409,
            )
          : jsonResponse({ id: 7, name: 'Website Redesign' }),
      )

      renderAt('/projects/7')
      const input = await screen.findByLabelText(/Project name/)

      await user.clear(input)
      await user.type(input, 'Sump survey')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => {
        expect(
          screen.getByText('A project with this name already exists.'),
        ).toBeInTheDocument()
      })
      expect(
        screen.getByRole('heading', { name: 'Website Redesign' }),
      ).toBeInTheDocument()
      expect(trackException).not.toHaveBeenCalled()
    })

    it('deletes the project and goes back to the list', async () => {
      const user = userEvent.setup()
      let deleted = false
      const fetchMock = mockFetch(async (url, init) => {
        if (init?.method === 'DELETE') {
          deleted = true
          return new Response(null, { status: 204 })
        }
        return /\/api\/projects$/.test(url)
          ? jsonResponse(deleted ? [] : [{ id: 7, name: 'Website Redesign' }])
          : jsonResponse({ id: 7, name: 'Website Redesign' })
      })

      renderAt('/projects/7')
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(screen.getByText('No projects yet.')).toBeInTheDocument()
      })
      const deleteCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'DELETE',
      )
      expect(deleteCall?.[0]).toMatch(/\/api\/projects\/7$/)
      expect(trackEvent).toHaveBeenCalledWith('ProjectDeleted')
    })

    it('shows error message when deleting fails', async () => {
      const user = userEvent.setup()
      mockFetch(async (_url, init) =>
        init?.method === 'DELETE'
          ? new Response(null, { status: 500 })
          : jsonResponse({ id: 7, name: 'Website Redesign' }),
      )

      renderAt('/projects/7')
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(
          screen.getByText('Unable to delete project.'),
        ).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    })
  })
})
