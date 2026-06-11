# ECP6 Error Tagging Schema

This package turns the `856`-word ECP6 list into a starter reference layer for an AI-based phonics app.

The point is not for the CSV to "detect" the error by itself. The point is for the CSV to tell the app:

- which word was targeted
- which error types are plausible for that word
- which label should appear on the dashboard
- which abstract detection target the AI should test

## Files

- `ecp6_words_inventory.csv`
- `ecp6_error_codes.csv`
- `ecp6_word_error_tags.csv`

## How To Use Them

`ecp6_words_inventory.csv`

- one row per target word
- gives the app a lightweight word inventory plus derived phonics features

`ecp6_error_codes.csv`

- one row per error code
- contains the dashboard-facing label plus the abstract detection target

`ecp6_word_error_tags.csv`

- one row per `word + error risk`
- this is the main lookup table for app logic and dashboard reporting

## Why The Detection Target Is Abstract

The app should not rely only on exact wrong strings like `fog` or `suh-top`.

Instead, the AI should test for patterns like:

- `EXTRA_VOWEL_INSERTED_INSIDE_CONSONANT_CLUSTER`
- `TARGET_FINAL_CONSONANT_NOT_REALIZED_OR_TOO_WEAK_TO_CONFIRM`
- `FINAL_E_PATTERN_FAILS_TO_TRIGGER_EXPECTED_LONG_VOWEL_READING_OR_SPELLING`

That makes the system more robust across accent variation, microphone noise, and non-identical wrong attempts.

## Suggested Pipeline

1. Student attempts a target word.
2. Speech or spelling engine produces a structured analysis.
3. App loads the matching rows from `ecp6_word_error_tags.csv`.
4. App tests the student's output against the listed abstract detection targets.
5. App sends the winning `chairman_label` and `error_code` to the dashboard.

## Important Note

This is a strong starter schema, not a finished linguistic gold standard.

The current tags are generated from word-level phonics features such as:

- onset cluster
- final cluster
- final consonant
- CVCe structure
- vowel team
- r-controlled pattern
- consonant digraph
- short-vowel-like structure
- longer-word segmentation risk

You can now refine the tags over time using:

- real student recordings
- teacher correction logs
- dashboard frequency data
- task-specific performance data
