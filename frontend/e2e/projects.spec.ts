import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// The backend started by playwright.config.ts.
const projectsApiUrl = 'http://localhost:5269/api/projects'

// Creates a project from the list page and waits for it to appear.
async function createProject(page: Page, name: string) {
  await page.getByLabel('Project name').fill(name)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
}

// Opens a project from the list page and waits for its detail page to load.
async function openProject(page: Page, name: string) {
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/\d+$/)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

test.describe('Project management', () => {
  test.beforeEach(async ({ page, request }) => {
    // Delete leftover projects (including ones other spec files created) through the API, since
    // deleting them in the UI races the page's initial load.
    const response = await request.get(projectsApiUrl)
    expect(response.ok()).toBe(true)
    for (const { id } of (await response.json()) as { id: number }[]) {
      expect((await request.delete(`${projectsApiUrl}/${id}`)).ok()).toBe(true)
    }

    // Wait for the initial load to finish, so its response can't overwrite a list the test changes.
    await page.goto('/')
    await expect(page.getByText('No projects yet.')).toBeVisible()
  })

  test.describe('Create project', () => {
    test('creates a new project', async ({ page }) => {
      await createProject(page, 'Daily chores')
    })

    test('trims whitespace from project name', async ({ page }) => {
      await page.getByLabel('Project name').fill('  Trimmed name  ')
      await page.getByRole('button', { name: 'Create project' }).click()

      await expect(
        page.getByRole('link', { name: 'Trimmed name', exact: true }),
      ).toBeVisible()
    })

    test('clears the input after creating a project', async ({ page }) => {
      await createProject(page, 'My list')
      await expect(page.getByLabel('Project name')).toHaveValue('')
    })

    test('displays projects in alphabetical order', async ({ page }) => {
      await createProject(page, 'Zulu')
      await createProject(page, 'Alpha')

      const items = page.getByRole('listitem')
      await expect(items).toHaveCount(2)
      await expect(items.nth(0)).toContainText('Alpha')
      await expect(items.nth(1)).toContainText('Zulu')
    })
  })

  test.describe('Navigation', () => {
    test('opens a project and goes back to the list', async ({ page }) => {
      await createProject(page, 'Groceries')
      await openProject(page, 'Groceries')

      await page.getByRole('link', { name: 'Back to projects' }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(
        page.getByRole('link', { name: 'Groceries', exact: true }),
      ).toBeVisible()
    })

    test('supports browser back and forward', async ({ page }) => {
      await createProject(page, 'Groceries')
      await openProject(page, 'Groceries')

      await page.goBack()
      await expect(
        page.getByRole('heading', { name: 'Create project' }),
      ).toBeVisible()

      await page.goForward()
      await expect(
        page.getByRole('heading', { name: 'Groceries', exact: true }),
      ).toBeVisible()
    })

    test('loads a project from a deep link', async ({ page }) => {
      await createProject(page, 'Deep link')
      await openProject(page, 'Deep link')

      await page.reload()

      await expect(
        page.getByRole('heading', { name: 'Deep link', exact: true }),
      ).toBeVisible()
      await expect(page.getByLabel('Project name')).toHaveValue('Deep link')
    })

    test('shows not found for a project that does not exist', async ({
      page,
    }) => {
      await page.goto('/projects/999999')

      await expect(
        page.getByRole('heading', { name: 'Page not found' }),
      ).toBeVisible()
      await page.getByRole('link', { name: 'Go to projects' }).click()
      await expect(page.getByText('No projects yet.')).toBeVisible()
    })

    test('shows not found for an unknown route', async ({ page }) => {
      await page.goto('/no/such/page')

      await expect(
        page.getByRole('heading', { name: 'Page not found' }),
      ).toBeVisible()
    })
  })

  test.describe('Rename project', () => {
    test('renames a project from its page', async ({ page }) => {
      await createProject(page, 'Original')
      await openProject(page, 'Original')

      await page.getByLabel('Project name').fill('Updated')
      await page.getByRole('button', { name: 'Save changes' }).click()

      await expect(
        page.getByRole('heading', { name: 'Updated', exact: true }),
      ).toBeVisible()

      await page.getByRole('link', { name: 'Back to projects' }).click()
      await expect(
        page.getByRole('link', { name: 'Updated', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Original', exact: true }),
      ).toBeHidden()
    })
  })

  test.describe('Delete project', () => {
    test('deletes a project and goes back to the list', async ({ page }) => {
      await createProject(page, 'To delete')
      await openProject(page, 'To delete')

      await page.getByRole('button', { name: 'Delete' }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByText('No projects yet.')).toBeVisible()
    })
  })

  test.describe('Error handling', () => {
    test('shows error when creating a project with a duplicate name', async ({
      page,
    }) => {
      await createProject(page, 'Unique name')

      await page.getByLabel('Project name').fill('Unique name')
      await page.getByRole('button', { name: 'Create project' }).click()

      await expect(
        page.getByText('A project with this name already exists.'),
      ).toBeVisible()
    })

    test('shows error when renaming a project to a duplicate name', async ({
      page,
    }) => {
      await createProject(page, 'First')
      await createProject(page, 'Second')
      await openProject(page, 'Second')

      await page.getByLabel('Project name').fill('First')
      await page.getByRole('button', { name: 'Save changes' }).click()

      await expect(
        page.getByText('A project with this name already exists.'),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Second', exact: true }),
      ).toBeVisible()
    })
  })
})
