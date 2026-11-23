import AxeBuilder from '@axe-core/playwright'
import { test, expect, sessionStorageEntry } from './fixtures'

// These start signed out, unlike the other specs.
test.use({ storageState: { cookies: [], origins: [] } })

test('shows the sign-in page until the user signs in', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Project name')).toBeHidden()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('signs in as a test user, keeps the sign-in after a reload, and signs out', async ({
  page,
}) => {
  const name = `Auth Tester ${Date.now()}`
  await page.goto('/')

  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Sign in as test user' }).click()

  await expect(page.getByText(name)).toBeVisible()
  await expect(page.getByText('No projects yet.')).toBeVisible()
  await page.reload()
  await expect(page.getByText(name)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible()
})

test('each user only sees their own projects', async ({ browser }) => {
  const stamp = Date.now()
  const signedInPage = async (name: string) => {
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: 'http://localhost:4173',
            localStorage: [sessionStorageEntry(name)],
          },
        ],
      },
    })
    return { context, page: await context.newPage() }
  }
  const alice = await signedInPage(`Alice ${stamp}`)
  const bob = await signedInPage(`Bob ${stamp}`)
  const projectName = `Alice's project ${stamp}`

  try {
    await alice.page.goto('/')
    await alice.page.getByLabel('Project name').fill(projectName)
    await alice.page.getByRole('button', { name: 'Create project' }).click()
    const link = alice.page.getByRole('link', { name: projectName })
    await expect(link).toBeVisible()
    const projectUrl = new URL(
      (await link.getAttribute('href')) ?? '',
      'http://localhost:4173',
    ).pathname

    await bob.page.goto('/')
    await expect(bob.page.getByText('No projects yet.')).toBeVisible()
    await expect(bob.page.getByRole('link', { name: projectName })).toBeHidden()
    await bob.page.goto(projectUrl)
    await expect(
      bob.page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
  } finally {
    await alice.context.close()
    await bob.context.close()
  }
})
