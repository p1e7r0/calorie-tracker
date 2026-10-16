CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fuzzy_word_match(haystack text, needle text, maximum_distance integer) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT position(needle IN haystack) > 0
    OR (
      maximum_distance > 0
      AND EXISTS (
        SELECT 1
        FROM regexp_split_to_table(haystack, '[^[:alnum:]]+') AS word
        WHERE word <> ''
          AND (
            public.levenshtein(needle, word) <= maximum_distance
            OR (length(needle) >= 5 AND public.levenshtein(needle, left(word, length(needle))) <= maximum_distance)
          )
      )
    )
$$;
