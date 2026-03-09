-- 100-Year Architectural Hardening
-- Part 1: B-Tree Indexes to prevent O(N) Full Table Scans for massive scaling

CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON public.visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_host_id ON public.visits (host_id);
CREATE INDEX IF NOT EXISTS idx_visits_premise_id ON public.visits (premise_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits (status);

CREATE INDEX IF NOT EXISTS idx_logs_actor_id ON public.logs ("actorId");
CREATE INDEX IF NOT EXISTS idx_logs_premise_id ON public.logs ("premiseId");
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.logs (action);

CREATE INDEX IF NOT EXISTS idx_checkin_tokens_visitor_id ON public.checkin_tokens (visitor_id);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_host_id ON public.checkin_tokens (host_id);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_premise_id ON public.checkin_tokens (premise_id);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_status ON public.checkin_tokens (status);

CREATE INDEX IF NOT EXISTS idx_agent_ledger_agent_id ON public.agent_ledger (agent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices ("userId");

CREATE INDEX IF NOT EXISTS idx_ratings_visit_id ON public.ratings ("visitId");
CREATE INDEX IF NOT EXISTS idx_ratings_visitor_id ON public.ratings ("visitorId");
CREATE INDEX IF NOT EXISTS idx_ratings_host_id ON public.ratings ("hostId");
CREATE INDEX IF NOT EXISTS idx_ratings_premise_id ON public.ratings ("premiseId");

CREATE INDEX IF NOT EXISTS idx_blocked_visitors_host ON public.host_blocks ("hostId", "visitorId");
CREATE INDEX IF NOT EXISTS idx_blocked_visitors_premise ON public.premise_blocks ("premiseId", "visitorId");

-- Part 2: Atomic Transaction Enforcements (RPCs)
-- Locks the row uniquely in Postgres preventing JS Thread Race Conditions

CREATE OR REPLACE FUNCTION deduct_user_tokens(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- FOR UPDATE ensures no other transaction can modify this user's balance concurrently
  SELECT token_balance_visitor INTO current_balance
  FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient tokens. Balance: % Required: %', current_balance, p_amount;
  END IF;

  -- Atomic Decrement
  UPDATE public.users SET token_balance_visitor = token_balance_visitor - p_amount WHERE id = p_user_id
  RETURNING token_balance_visitor INTO current_balance;

  RETURN current_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION deduct_premise_tokens(p_premise_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- FOR UPDATE ensures no other transaction can modify this premise concurrenty
  SELECT token_balance INTO current_balance
  FROM public.premises WHERE id = p_premise_id FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Premise not found.';
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient premise tokens. Balance: % Required: %', current_balance, p_amount;
  END IF;

  -- Atomic Decrement
  UPDATE public.premises SET token_balance = token_balance - p_amount WHERE id = p_premise_id
  RETURNING token_balance INTO current_balance;

  RETURN current_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
