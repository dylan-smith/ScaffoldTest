import { useEffect, useState } from 'react'
import type { SubmitEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Link } from 'react-router'
import {
  ApiError,
  createProject,
  describeFetchError,
  listProjects,
} from '../api/projects'
import type { Project } from '../api/projects'
import { trackEvent, trackException } from '../telemetry'

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setErrorMessage('')

    try {
      setProjects(await listProjects())
    } catch (error) {
      trackException(error, { operation: 'load' })
      setErrorMessage(describeFetchError(error, 'Unable to load projects.'))
    } finally {
      setLoading(false)
    }
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
      await createProject(trimmedName)
      trackEvent('ProjectCreated')
      setName('')
      await load()
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

  return (
    <Stack spacing={2}>
      <Paper component="section" elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Create project
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
            placeholder="e.g. Website redesign"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create project'}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Paper component="section" elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Projects
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress aria-label="Loading" />
          </Box>
        ) : projects.length === 0 ? (
          <Typography color="text.secondary">No projects yet.</Typography>
        ) : (
          <List disablePadding>
            {projects.map((project) => (
              <ListItem key={project.id} divider disablePadding>
                <ListItemButton component={Link} to={`/projects/${project.id}`}>
                  <ListItemText
                    primary={project.name}
                    sx={{ overflowWrap: 'anywhere' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  )
}

export default ProjectsPage
