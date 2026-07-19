LOCK TABLE event_journal IN ACCESS EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS event_journal_allocate_cursor_in_commit_order
  ON event_journal;
DROP FUNCTION IF EXISTS allocate_event_journal_cursor_in_commit_order();

ALTER TABLE event_journal
  ALTER COLUMN cursor
  SET DEFAULT nextval('event_journal_cursor_seq'::regclass);
