import { apiBaseUrl } from '../config'
import { apiFetch } from './client'

export type Project = {
  id: number
  name: string
}

type ErrorResponse = {
  message?: string
}

// Thrown for a response the caller should show to the user as is, such as a 409 for a duplicate name.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// fetch rejects with a TypeError when the API can't be reached at all, including while a deployment has
// it paused (see the deploy-backend job in ci.yml), so tell the user to retry rather than show a generic error.
export const unreachableMessage =
  "Can't reach ScaffoldTest right now. It may be updating, so try again in a minute."

export function describeFetchError(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return unreachableMessage
  }
  return error instanceof ApiError ? error.message : fallback
}

const projectsUrl = `${apiBaseUrl}/api/projects`

export async function listProjects(): Promise<Project[]> {
  const response = await apiFetch(projectsUrl)
  if (!response.ok) {
    throw new Error('Unable to load projects.')
  }
  return (await response.json()) as Project[]
}

// Returns null when there's no project with this id.
export async function getProject(id: number): Promise<Project | null> {
  const response = await apiFetch(`${projectsUrl}/${id}`)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Unable to load project.')
  }
  return (await response.json()) as Project
}

async function saveProject(url: string, method: 'POST' | 'PUT', name: string) {
  const response = await apiFetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (response.status === 409) {
    const error = (await response.json()) as ErrorResponse
    throw new ApiError(
      409,
      error.message ?? 'A project with this name already exists.',
    )
  }
  if (!response.ok) {
    throw new Error('Unable to save project.')
  }
  return (await response.json()) as Project
}

export function createProject(name: string) {
  return saveProject(projectsUrl, 'POST', name)
}

export function updateProject(id: number, name: string) {
  return saveProject(`${projectsUrl}/${id}`, 'PUT', name)
}

// A 404 means the project is already gone, which is what the caller wanted.
export async function deleteProject(id: number) {
  const response = await apiFetch(`${projectsUrl}/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 404) {
    throw new Error('Unable to delete project.')
  }
}
