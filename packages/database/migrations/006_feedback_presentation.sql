ALTER TABLE feedback_templates
  ADD COLUMN presentation text NOT NULL DEFAULT 'compact'
    CHECK (presentation IN ('compact', 'steps', 'conversation')),
  ADD COLUMN questions_per_step integer
    CHECK (questions_per_step IS NULL OR questions_per_step > 0);
