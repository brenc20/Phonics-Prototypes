(function(){
  const runtime = window.ECP6_ERROR_TAG_RUNTIME || { tagsByWord:{}, codesByErrorCode:{} };
  const PRIORITY_SCORE = { high: 3, medium: 2, low: 1 };
  const OBSERVED_TO_CODE = {
    shortVowelConfusion: "SHORT_VOWEL_SHIFT",
    "short vowel confusion": "SHORT_VOWEL_SHIFT",
    finalSoundMissing: "FINAL_CONSONANT_DELETION",
    "final sound missing": "FINAL_CONSONANT_DELETION",
    finalConsonantConfusion: "FINAL_CONSONANT_DELETION",
    "final consonant confusion": "FINAL_CONSONANT_DELETION",
    initialConsonantConfusion: "SIMILAR_CONSONANT_SHIFT",
    "initial consonant confusion": "SIMILAR_CONSONANT_SHIFT",
    similarConsonantPairConfusion: "SIMILAR_CONSONANT_SHIFT",
    "similar consonant-pair confusion": "SIMILAR_CONSONANT_SHIFT",
    cvceError: "FINAL_E_RULE_NOT_REALIZED",
    "cvce / final-e error": "FINAL_E_RULE_NOT_REALIZED",
    "word family confusion": "VOWEL_TEAM_NOT_REALIZED",
    wordFamilyConfusion: "VOWEL_TEAM_NOT_REALIZED",
    blendingWeakness: "INCOMPLETE_SOUND_CHAIN",
    "blending weakness": "INCOMPLETE_SOUND_CHAIN",
    segmentationWeakness: "PHONEME_COUNT_MISMATCH",
    "segmentation weakness": "PHONEME_COUNT_MISMATCH",
    encodingPatternBreakdown: "ENCODING_PATTERN_BREAKDOWN",
    "sound-to-spelling / dictation error": "ENCODING_PATTERN_BREAKDOWN"
  };
  const TASK_SCOPE = {
    pronunciation: ["pronunciation"],
    reading: ["reading","pronunciation"],
    spelling: ["spelling","dictation"],
    dictation: ["dictation","spelling"],
    segmentation_task: ["segmentation_task","reading","pronunciation"]
  };

  function normalizeWord(word){
    return String(word || "").trim().toLowerCase();
  }

  function normalizeHint(hint){
    return String(hint || "").trim();
  }

  function scopesForTask(taskType){
    return TASK_SCOPE[taskType] || [taskType];
  }

  function scopeMatches(tag, taskType){
    const scopes = String(tag.detection_scope || "").split("|").map((s)=>s.trim()).filter(Boolean);
    const desired = scopesForTask(taskType);
    return desired.some((scope)=>scopes.includes(scope));
  }

  function tagsForWord(word){
    return runtime.tagsByWord[normalizeWord(word)] || [];
  }

  function matchObservedCode(observedHint){
    const hint = normalizeHint(observedHint);
    return OBSERVED_TO_CODE[hint] || OBSERVED_TO_CODE[hint.replace(/\s+/g, "")] || null;
  }

  function buildFallbackFlag(word, options){
    const observedHint = normalizeHint(options.observedHint);
    const taskType = options.taskType || "reading";
    const response = options.response || "";
    const confidence = options.confidence ?? 0.55;
    if (observedHint === "contextualGuessing" || observedHint === "contextual guessing") {
      return {
        errorType: "contextual guessing",
        error_code: "CONTEXTUAL_GUESSING",
        chairman_label: "contextual guessing",
        abstract_detection_target: "WRONG_CONTEXT_SELECTED_FOR_TARGET_WORD",
        dashboard_group: "context_errors",
        detection_scope: taskType,
        risk_priority: "medium",
        confidence,
        task_type: taskType,
        feature_trigger: "context_selection",
        word,
        attemptedValue: response,
        position: options.position || taskType
      };
    }
    return {
      errorType: observedHint || "unclassified phonics issue",
      error_code: "UNCLASSIFIED_ECP6_ERROR",
      chairman_label: observedHint || "unclassified phonics issue",
      abstract_detection_target: "OBSERVED_BEHAVIOR_REQUIRES_REVIEW",
      dashboard_group: "needs_review",
      detection_scope: taskType,
      risk_priority: "low",
      confidence,
      task_type: taskType,
      feature_trigger: "fallback",
      word,
      attemptedValue: response,
      position: options.position || taskType
    };
  }

  function scoreTag(tag, options){
    let score = PRIORITY_SCORE[tag.risk_priority] || 0;
    if (scopeMatches(tag, options.taskType)) score += 10;
    const desiredCode = matchObservedCode(options.observedHint);
    if (desiredCode && tag.error_code === desiredCode) score += 8;
    const hint = normalizeHint(options.observedHint).toLowerCase();
    if (hint && String(tag.chairman_label || "").toLowerCase() === hint) score += 5;
    if (hint && String(tag.dashboard_group || "").toLowerCase().includes(hint.replace(/\s+/g, "_"))) score += 2;
    return score;
  }

  function chooseBestTag(word, options = {}){
    const allTags = tagsForWord(word);
    if (!allTags.length) return buildFallbackFlag(word, options);

    const scoped = allTags.filter((tag) => scopeMatches(tag, options.taskType));
    const pool = scoped.length ? scoped : allTags;
    const best = pool.slice().sort((a,b) => scoreTag(b, options) - scoreTag(a, options))[0];
    if (!best) return buildFallbackFlag(word, options);

    return {
      errorType: best.chairman_label,
      error_code: best.error_code,
      chairman_label: best.chairman_label,
      abstract_detection_target: best.abstract_detection_target,
      dashboard_group: best.dashboard_group,
      detection_scope: best.detection_scope,
      risk_priority: best.risk_priority,
      confidence: options.confidence ?? (scopeMatches(best, options.taskType) ? 0.88 : 0.61),
      task_type: options.taskType || "reading",
      feature_trigger: best.feature_trigger,
      word,
      attemptedValue: options.response || "",
      position: options.position || options.taskType || "unknown"
    };
  }

  window.PolyPhonicsErrorRuntime = {
    runtime,
    tagsForWord,
    chooseBestTag,
    buildFallbackFlag
  };
})();
