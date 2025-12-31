# Deprecated Files

This folder contains deprecated code kept for reference only.

## Files

### characterData.ts
**Status**: DEPRECATED as of December 2024
**Reason**: Characters are now loaded from PostgreSQL database
**Replacement**:
- Server: Use `CharacterService` (loads from DB)
- Client: Fetch from `GET /api/characters` endpoint

**Do not import or use these files in new code.**

See `server/src/database/schema.sql` for the current character data source.
