# U13 CI/Automated Testing Setup

## Overview
This document describes the automated testing infrastructure for US13 (Player Match History).

## Test Files
- **Backend Tests**: `src/history.test.ts` (8 tests)
  - Tests all acceptance criteria for the `/api/users/:id/history` endpoint
  - Tests user stats aggregation in `/api/users/:id` endpoint
  - Validates pagination, filtering, and error handling

## GitHub Actions Workflow

### Workflow File
**.github/workflows/test.yml**

This workflow runs all automated tests (including U13 tests) on:
- **Push events** to the `main` branch
- **Pull requests** targeting the `main` branch

### Jobs
1. **backend-tests**
   - Runs all backend tests using `npm test` (vitest)
   - Includes the 8 U13 tests in `src/history.test.ts`
   
2. **frontend-tests**
   - Runs all frontend tests using `npm test --prefix frontend`
   - Includes tests for PlayerProfilePage which displays match history

### Test Coverage for U13

The backend tests (`src/history.test.ts`) verify:

1. ✅ `GET /api/users/:id/history` returns 200 with correct fields for finalized tournaments
2. ✅ Filtering by `?game=<game>` works and returns empty array when no matches
3. ✅ Pagination params `page` and `pageSize` are respected, `total` is accurate
4. ✅ `GET /api/users/:id` includes totalTournaments, totalWins, totalLosses, bestPlacement
5. ✅ Returns 404 for non-existent users
6. ✅ Returns empty history for users with no finalized tournaments
7. ✅ Excludes non-finalized tournaments from history
8. ✅ Game filter is case-insensitive

## Running Tests Locally

### Backend tests only
```bash
npm test
```

### Frontend tests only
```bash
npm test --prefix frontend
```

### All tests
```bash
npm test && npm test --prefix frontend
```

## Viewing CI Results

1. Navigate to the [Actions tab](https://github.com/afeies/match-point/actions) in GitHub
2. Select the "CI Tests" workflow
3. View recent runs to see test results
4. Both `backend-tests` and `frontend-tests` jobs must pass for the workflow to succeed

## Related Issues
- #44 - US13: Player Match History on Profile (implementation)
- #49 - Add CI/Automated Tests for US13 (this setup)
