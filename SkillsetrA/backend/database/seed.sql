-- ====================================================================
-- SkillsetrA Database Seed Reference File
-- Safe sample questions for master Question Bank (APTITUDE and VERBAL)
-- Note: Official Admin and Student accounts will be created securely in auth steps.
-- ====================================================================

-- 1. Sample Aptitude Questions
INSERT INTO questions (question_text, category, difficulty, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
VALUES
(
    'If a train running at 60 km/hr crosses a pole in 9 seconds, what is the length of the train?',
    'APTITUDE',
    'MEDIUM',
    '120 metres',
    '180 metres',
    '150 metres',
    '300 metres',
    'C',
    1,
    TRUE
),
(
    'A and B together can do a piece of work in 15 days, while B alone can do it in 20 days. In how many days can A alone do it?',
    'APTITUDE',
    'MEDIUM',
    '30 days',
    '40 days',
    '60 days',
    '45 days',
    'C',
    1,
    TRUE
),
(
    'What is the average of first 5 multiples of 3?',
    'APTITUDE',
    'EASY',
    '9',
    '12',
    '15',
    '18',
    'A',
    1,
    TRUE
),
(
    'A vendor bought toffees at 6 for a rupee. How many for a rupee must he sell to gain 20%?',
    'APTITUDE',
    'HARD',
    '3',
    '4',
    '5',
    '6',
    'C',
    1,
    TRUE
),
(
    'Two pipes A and B can fill a tank in 20 and 30 minutes respectively. If both pipes are opened together, the time taken to fill the tank is:',
    'APTITUDE',
    'EASY',
    '12 minutes',
    '15 minutes',
    '25 minutes',
    '50 minutes',
    'A',
    1,
    TRUE
);

-- 2. Sample Verbal Questions
INSERT INTO questions (question_text, category, difficulty, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
VALUES
(
    'Select the synonym of "PRUDENT":',
    'VERBAL',
    'EASY',
    'Reckless',
    'Cautious',
    'Foolish',
    'Careless',
    'B',
    1,
    TRUE
),
(
    'Select the antonym of "BENEVOLENT":',
    'VERBAL',
    'EASY',
    'Kind',
    'Generous',
    'Malevolent',
    'Friendly',
    'C',
    1,
    TRUE
),
(
    'Fill in the blank: The committee _____ divided in their opinions.',
    'VERBAL',
    'MEDIUM',
    'was',
    'were',
    'is',
    'are',
    'B',
    1,
    TRUE
),
(
    'Identify the correctly spelt word:',
    'VERBAL',
    'MEDIUM',
    'Accomodate',
    'Accommodate',
    'Acomodate',
    'Acommodate',
    'B',
    1,
    TRUE
),
(
    'Choose the word which best expresses the meaning of "EPHEMERAL":',
    'VERBAL',
    'HARD',
    'Permanent',
    'Short-lived',
    'Eternal',
    'Substantial',
    'B',
    1,
    TRUE
);
