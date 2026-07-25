-- Question Stars: Allow users to "star" questions to show interest
-- Run this SQL in your Supabase SQL editor

-- 1. CREATE QUESTION STARS TABLE
CREATE TABLE IF NOT EXISTS public.question_stars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.event_questions(id) ON DELETE CASCADE,

  -- Who starred it (authenticated users)
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- For non-authenticated users (browser session identifier)
  session_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate stars per user
  CONSTRAINT unique_star_per_profile UNIQUE (question_id, profile_id),
  CONSTRAINT unique_star_per_session UNIQUE (question_id, session_id)
);

-- 2. CREATE INDEXES
CREATE INDEX idx_question_stars_question_id ON public.question_stars(question_id);
CREATE INDEX idx_question_stars_profile_id ON public.question_stars(profile_id);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.question_stars ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES
CREATE POLICY "Everyone can view star counts"
  ON public.question_stars FOR SELECT
  USING (true);

CREATE POLICY "Anyone can star questions"
  ON public.question_stars FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can remove their own stars"
  ON public.question_stars FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND profile_id = auth.uid())
    OR
    (session_id IS NOT NULL)
  );

-- 5. CREATE VIEW: Question with star count
-- (Update the existing event_questions_with_details view if needed, or use a separate query)
-- We'll handle star counts in the application layer for flexibility.
