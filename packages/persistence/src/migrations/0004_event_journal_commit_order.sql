-- Serialize event cursor allocation until the inserting transaction resolves.
--
-- PostgreSQL sequences are intentionally non-transactional. With BIGSERIAL's
-- default, transaction A can allocate cursor 1, transaction B can allocate and
-- commit cursor 2, and A can commit cursor 1 later. A replay checkpoint at 2
-- would then permanently miss A's event.
--
-- Allocating in a BEFORE INSERT trigger after taking a transaction-scoped
-- advisory lock makes cursor order agree with commit visibility. The lock is
-- held until commit or rollback, and the trigger covers every insert path,
-- including callers that try to supply a cursor explicitly. Sequence gaps on
-- rollback remain intentional.

LOCK TABLE event_journal IN ACCESS EXCLUSIVE MODE;

ALTER TABLE event_journal
  ALTER COLUMN cursor DROP DEFAULT;

CREATE OR REPLACE FUNCTION allocate_event_journal_cursor_in_commit_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sequence_name TEXT;
BEGIN
  -- Namespace the lock by the relation OID while keeping it in the positive
  -- signed-bigint range. Different schema-local test tables do not contend.
  PERFORM pg_advisory_xact_lock(6000000000000000000::BIGINT + TG_RELID::BIGINT);

  sequence_name := pg_get_serial_sequence(
    format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME),
    'cursor'
  );
  IF sequence_name IS NULL THEN
    RAISE EXCEPTION '%.%.cursor has no owned sequence', TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END IF;

  NEW.cursor := nextval(sequence_name::regclass);
  RETURN NEW;
END
$$;

CREATE TRIGGER event_journal_allocate_cursor_in_commit_order
BEFORE INSERT ON event_journal
FOR EACH ROW
EXECUTE FUNCTION allocate_event_journal_cursor_in_commit_order();
