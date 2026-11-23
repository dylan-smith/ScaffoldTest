import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

// The backend started by playwright.config.ts.
const projectsApiUrl = 'http://localhost:5269/api/projects'

test.describe('Accessibility', () => {
  test('main page has no detectable accessibility violations', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'ScaffoldTest' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Create project' }),
    ).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
  })

  test('project page has no detectable accessibility violations', async ({
    page,
    request,
  }) => {
    const response = await request.post(projectsApiUrl, {
      data: { name: `A11y test project ${Date.now()}` },
    })
    expect(response.ok()).toBe(true)
    const { id, name } = (await response.json()) as { id: number; name: string }

    try {
      await page.goto(`/projects/${id}`)
      await expect(page.getByRole('heading', { name })).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()

      expect(results.violations).toEqual([])
    } finally {
      await request.delete(`${projectsApiUrl}/${id}`)
    }
  })

  test('not found page has no detectable accessibility violations', async ({
    page,
  }) => {
    await page.goto('/no/such/page')
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations).toEqual([])
  })
})
