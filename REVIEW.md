# Code Review

All issues below have been fixed. This document is kept for reference.

## Critical Issues (Fixed)

### 1. `NODE_ENV` → `APP_ENV`

Replaced all `NODE_ENV` references with `APP_ENV` and extracted a shared `is_production()` helper in `config/settings.py`. Also fixes issue #13 (repeated env checks).

### 2. `__pycache__/` directories removed

Deleted all `__pycache__` dirs from the tree.

### 3. Dead `_SECURE_COOKIE` constant removed

Removed the unused module-level constant in `handlers/auth.py`. `_session_cookie_kwargs()` now uses `is_production()`.

### 4. Login no longer calls `delete_cookie` before `set_cookie`

Removed the redundant `delete_cookie` call — `set_cookie` overwrites the value directly.

### 5. Login now uses a transaction

Created `login_user()` in the repository that wraps `delete_sessions_for_user` + `create_session` in `with_transaction()`, matching how registration works.

## Design / Architecture (Fixed)

### 6. Consistent return types from repository layer

`find_user_by_email()` now returns `UserWithPassword` (a new Pydantic model) instead of a raw dict. All repository functions return typed models.

### 7. Unused `patch_helpers.py` removed

Deleted `db/patch_helpers.py` and `tests/unit/test_patch_helpers.py`.

### 8. Flattened directory structure

`handlers/auth/auth.py` → `handlers/auth.py`, `repositories/auth/auth.py` → `repositories/auth.py`. Removed the unnecessary nested `auth/` subdirectories.

### 9. Session cleanup function added

Added `delete_expired_sessions()` to the auth repository for periodic cleanup of expired session rows.

## Security (Fixed)

### 10. UUID parsing accepts all versions

Replaced the hand-rolled regex (v1-5 only) with Python's `uuid.UUID()` constructor, which accepts any valid UUID including v6/v7/v8.

### 11. Password max-length enforced

`RegisterInput` now rejects passwords longer than 72 characters (bcrypt's input limit). Test added.

### 12. Rate limiter warns in production

`rate_limiter.py` now reads `RATE_LIMIT_STORAGE_URI` from env (added to `.env.example`) and prints a warning to stderr when production uses in-memory storage.

## Code Quality (Fixed)

### 13. `is_production()` centralized

All 8+ inline `os.getenv("NODE_ENV") == "production"` checks replaced with a single `is_production()` call from `config/settings.py`.

### 14. `conn` parameter typed

`create_user()`, `create_session()`, and `delete_sessions_for_user()` now have proper `psycopg.Connection | None` type annotations.

### 15. Imports moved to top of file

`from datetime import ...` moved out of `create_session()` body to the module top level in `repositories/auth.py`.

### 16. Port default changed to 8000

`.env.example` and `Makefile` updated from Node's conventional port 3000 to Python's conventional port 8000.

## Testing (Fixed)

### 17. Test for password max length added

`test_schemas.py` now includes `test_password_too_long`.

### 18. Test for UUID v7 added

`test_parsers.py` now includes `test_valid_uuid_v7` to verify the new parser accepts modern UUID versions.

## Not Fixed (Out of Scope)

- **No integration/route-level tests**: The test suite still only covers pure functions. Adding full integration tests requires a test database setup and is a separate effort.
- **`conftest.py` hardcoded DB URL**: Kept as-is since integration tests will need a real database URL. The `setdefault` approach is reasonable for CI where the env var is set externally.
- **`alembic.ini` file template**: Left as-is — the hand-named migration files work correctly.
