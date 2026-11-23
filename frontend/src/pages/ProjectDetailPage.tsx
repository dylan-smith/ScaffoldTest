import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ApiError,
  deleteProject,
  describeFetchError,
  getProject,
  updateProject,
} from '../api/projects'
import type { Project } from '../api/projects'
import { trackEvent, trackException } from '../telemetry'
import NotFoundPage from './NotFoundPage'
import { parseId } from './parseId'

function ProjectDetail({ id }: { id: number }) {
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Ignore a response that arrives after the user has left the page.
    let current = true

    async function load() {
      try {
        const loaded = await getProject(id)
        if (!current) {
          return
        }
        if (loaded === null) {
          setNotFound(true)
        } else {
          setProject(loaded)
          setName(loaded.name)
        }
      } catch (error) {
        if (!current) {
          return
        }
        trackException(error, { operation: 'load' })
        setErrorMessage(describeFetchError(error, 'Unable to load project.'))
      } finally {
        if (current) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      current = false
    }
  }, [id])

  if (notFound) {
    return (
      <NotFoundPage message="That project doesn't exist. It may have been deleted." />
    )
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage('Project name is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const saved = await updateProject(id, trimmedName)
      trackEvent('ProjectUpdated')
      setProject(saved)
      setName(saved.name)
    } catch (error) {
      // A duplicate name is the user's to fix, not a failure to report.
      if (!(error instanceof ApiError)) {
        trackException(error, { operation: 'save' })
      }
      setErrorMessage(describeFetchError(error, 'Unable to save project.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setErrorMessage('')

    try {
      await deleteProject(id)
      trackEvent('ProjectDeleted')
      void navigate('/')
    } catch (error) {
      trackException(error, { operation: 'delete' })
      setErrorMessage(describeFetchError(error, 'Unable to delete project.'))
      setDeleting(false)
    }
  }

  const editing = submitting || deleting

  return (
    <Stack spacing={2}>
      <Box>
        <Button component={Link} to="/">
          ← Back to projects
        </Button>
      </Box>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress aria-label="Loading" />
        </Box>
      ) : (
        project && (
          <Paper component="section" elevation={2} sx={{ p: 3 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mb: 2, overflowWrap: 'anywhere' }}
            >
              {project.name}
            </Typography>
            <Box
              component="form"
              onSubmit={(event) => void handleSubmit(event)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                id="project-name"
                label="Project name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button type="submit" variant="contained" disabled={editing}>
                  {submitting ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  color="error"
                  variant="outlined"
                  disabled={editing}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </Stack>
            </Box>
          </Paper>
        )
      )}
    </Stack>
  )
}

function ProjectDetailPage() {
  const id = parseId(useParams().id)
  if (id === null) {
    return <NotFoundPage />
  }
  // Keyed by id so going back or forward between two projects starts each one with fresh state.
  return <ProjectDetail key={id} id={id} />
}

export default ProjectDetailPage
