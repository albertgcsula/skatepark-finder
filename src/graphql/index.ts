/**
 * GraphQL operations index
 * 
 * Centralized exports for all GraphQL queries, mutations, and subscriptions.
 */

// Queries
export {
  // Skatepark queries
  listSkateparks,
  getSkateparkById,
  listSkateparksByRegion,
  listSkateparksByGeohash,
  filterSkateparksByPlaceType,
  searchSkateparksByName,
  listSkateparksWithImages,
  getSkateparksByRegionAndType,
  
  // Recommendation queries
  listRecommendations,
  getRecommendationById,
  filterRecommendationsByStatus,
  getPendingRecommendations,
  getApprovedRecommendations,
  filterRecommendationsByType,
  getRecommendationsByStatusAndType,
  getValidRecommendations,
  
  // Helper functions
  fetchAllSkateparks,
  fetchAllRecommendations,
  countSkateparksByRegion,
  countSkateparksByPlaceType,
} from './queries'

// Mutations
export {
  // Skatepark mutations
  createSkatepark,
  updateSkatepark,
  deleteSkatepark,
  bulkCreateSkateparks,
  
  // Recommendation mutations
  createRecommendation,
  updateRecommendationStatus,
  approveRecommendation,
  rejectRecommendation,
  updateRecommendation,
  deleteRecommendation,
  bulkApproveRecommendations,
  bulkRejectRecommendations,
  deleteBotRecommendations,
} from './mutations'

// Subscriptions
export {
  // Skatepark subscriptions
  onCreateSkatepark,
  onUpdateSkatepark,
  onDeleteSkatepark,
  
  // Recommendation subscriptions
  onCreateRecommendation,
  onUpdateRecommendation,
  onDeleteRecommendation,
  
  // Combined subscriptions
  subscribeToAllSkateparkEvents,
  subscribeToAllRecommendationEvents,
} from './subscriptions'
