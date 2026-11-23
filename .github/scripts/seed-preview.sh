#!/usr/bin/env bash
# Seeds a preview environment with the sample projects in preview-seed-data.json, through the API so the data
# goes through the same validation as real use. Runs after the smoke tests, which have already waited for the API
# to be ready.
#
# Every deployment starts the preview over: it deletes every project of the seed's user first, so whatever
# reviewers changed as that user is gone and the samples are never duplicated. Projects other test users made are
# left alone. A seed that stops partway is redone in full by the next deployment.
# Requires API_URL and API_AUTH_TOKEN (the test sign-in the projects are created for), and runs from the
# repository root.
set -euo pipefail

seed_file=.github/scripts/preview-seed-data.json

api() {
  curl --fail-with-body --silent --show-error --max-time 60 -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${API_AUTH_TOKEN}" "$@"
}

# Only reads are retried: a retried POST or DELETE whose first attempt did go through would fail or duplicate.
existing="$(api --retry 3 --retry-all-errors "${API_URL}/api/projects")"
deleted=0
for id in $(jq -r '.[].id' <<<"${existing}"); do
  api -X DELETE "${API_URL}/api/projects/${id}" --output /dev/null
  deleted=$((deleted + 1))
done
echo "Deleted the preview's ${deleted} project(s)"

count="$(jq length "${seed_file}")"
for i in $(seq 0 $((count - 1))); do
  name="$(jq -r ".[${i}].name" "${seed_file}")"
  id="$(jq -c "{name: .[${i}].name}" "${seed_file}" | api -X POST --data @- "${API_URL}/api/projects" | jq -r .id)"
  echo "Added project ${id}, \"${name}\""
done

echo "Seeded the preview with ${count} projects"
