type EpisodeData = Array<{
  num: number;
  srt_oss_key: string;
  video_oss_key: string;
  negative_oss_key: string;
}>;

function pickFirstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find(value => value !== undefined);
}

export function normalizeOrderFromBackend<T extends Record<string, any>>(order: T): T {
  const episodesData = pickFirstDefined<EpisodeData>(
    order.episodesData,
    order.episodes_data,
    order.episodeData,
    order.episode_data
  ) || [];

  const confirmedMovieJson = pickFirstDefined(
    order.confirmedMovieJson,
    order.confirmed_movie_json
  ) || null;

  return {
    ...order,
    movieSource: pickFirstDefined(order.movieSource, order.movie_source) || 'existing',
    templateSource: pickFirstDefined(order.templateSource, order.template_source) || 'existing',
    targetPlatform: pickFirstDefined(order.targetPlatform, order.target_platform) || '',
    targetCharacterName: pickFirstDefined(order.targetCharacterName, order.target_character_name) || '',
    vendorRequirements: pickFirstDefined(order.vendorRequirements, order.vendor_requirements) || '',
    storyInfo: pickFirstDefined(order.storyInfo, order.story_info) || '',
    videoPath: pickFirstDefined(order.videoPath, order.video_path) || '',
    videoSrtPath: pickFirstDefined(order.videoSrtPath, order.video_srt_path) || '',
    viralSrtPath: pickFirstDefined(order.viralSrtPath, order.viral_srt_path) || '',
    viralVideoPath: pickFirstDefined(order.viralVideoPath, order.viral_video_path) || '',
    narratorType: pickFirstDefined(order.narratorType, order.narrator_type) || '',
    modelVersion: pickFirstDefined(order.modelVersion, order.model_version) || '',
    learningModelId: pickFirstDefined(order.learningModelId, order.learning_model_id) || '',
    episodesData,
    confirmedMovieJson,
    copywritingType: pickFirstDefined(order.copywritingType, order.copywriting_type) || 'secondary',
    originalMode: pickFirstDefined(order.originalMode, order.original_mode) || '',
    originalLanguage: pickFirstDefined(order.originalLanguage, order.original_language) || '',
    originalModel: pickFirstDefined(order.originalModel, order.original_model) || 'flash',
    videoUrl: pickFirstDefined(order.videoUrl, order.video_url) || '',
    errorMessage: pickFirstDefined(order.errorMessage, order.error_message) || '',
    createdAt: pickFirstDefined(order.createdAt, order.created_at) || 0,
    updatedAt: pickFirstDefined(order.updatedAt, order.updated_at) || 0,
    tasks: Array.isArray(order.tasks) ? order.tasks : []
  };
}

export function serializeOrderForBackend<T extends Record<string, any>>(order: T): Record<string, any> {
  const { createdAt, updatedAt, ...rest } = order;
  const normalized = normalizeOrderFromBackend(rest);
  const {
    createdAt: normalizedCreatedAt,
    updatedAt: normalizedUpdatedAt,
    episodesData,
    confirmedMovieJson,
    ...payload
  } = normalized;

  return {
    ...payload,
    episodesData,
    confirmedMovieJson,
    target_platform: payload.targetPlatform,
    target_character_name: payload.targetCharacterName,
    vendor_requirements: payload.vendorRequirements,
    story_info: payload.storyInfo,
    video_path: payload.videoPath,
    video_srt_path: payload.videoSrtPath,
    viral_srt_path: payload.viralSrtPath,
    viral_video_path: payload.viralVideoPath,
    narrator_type: payload.narratorType,
    model_version: payload.modelVersion,
    learning_model_id: payload.learningModelId,
    copywriting_type: payload.copywritingType,
    original_mode: payload.originalMode,
    original_language: payload.originalLanguage,
    original_model: payload.originalModel,
    video_url: payload.videoUrl,
    error_message: payload.errorMessage
  };
}
