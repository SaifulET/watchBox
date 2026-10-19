import fs from 'node:fs';
import path from 'node:path';

const sourcePostmanPath = path.join(process.cwd(), 'docs', 'postman', 'watchbox-api.postman_collection.json');
const targetAppCollectionPath = 'd:/nahid/the_watch_box/the_watch_box/collection.json';
const targetBackendCollectionPath = path.join(process.cwd(), 'collection.json');
const targetBackendDocsPath = path.join(process.cwd(), 'docs', 'postman', 'collection.json');

const raw = JSON.parse(fs.readFileSync(sourcePostmanPath, 'utf8'));

// Helpful route metadata map for documentation
const routeMeta = {
  // Auth
  'POST /api/v1/auth/login': {
    title: 'Customer Login',
    feature: 'LoginScreen / AuthController.login()',
    desc: 'Authenticates customer credentials (email & password) and returns JWT access & refresh tokens along with user account info.',
    auth: 'Public'
  },
  'POST /api/v1/auth/register': {
    title: 'Customer Registration',
    feature: 'Registration / AuthController',
    desc: 'Registers a new customer account with email, password, and display name.',
    auth: 'Public'
  },
  'POST /api/v1/auth/refresh': {
    title: 'Refresh Session Token',
    feature: 'Session Management / AuthController',
    desc: 'Exchanges a valid refresh token for a fresh JWT access token.',
    auth: 'Public'
  },
  'POST /api/v1/auth/logout': {
    title: 'Logout Active Session',
    feature: 'ProfileTab / AuthController.logout()',
    desc: 'Invalidates the current session token on the server and terminates the active session.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/auth/logout-all': {
    title: 'Logout All Sessions',
    feature: 'Security Settings / AuthController',
    desc: 'Invalidates all active login sessions across all devices for this user.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/auth/forgot-password': {
    title: 'Request Password Reset Email',
    feature: 'ForgotPasswordScreen',
    desc: 'Sends a password reset email containing a verification token to the user email.',
    auth: 'Public'
  },
  'POST /api/v1/auth/reset-password': {
    title: 'Reset Password with Token',
    feature: 'ResetPasswordScreen',
    desc: 'Resets user password using the token received via email.',
    auth: 'Public'
  },
  'POST /api/v1/auth/change-password': {
    title: 'Change Password (Authenticated)',
    feature: 'ChangePasswordScreen',
    desc: 'Allows authenticated users to change their password by confirming current password.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/auth/sessions': {
    title: 'List Active Login Sessions',
    feature: 'AccountSettingsScreen (Active Devices)',
    desc: 'Lists all active login sessions, device user-agents, IP addresses, and creation timestamps.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/auth/sessions/:sessionId': {
    title: 'Revoke Specific Session',
    feature: 'AccountSettingsScreen (Device Revoke)',
    desc: 'Revokes a specific session by sessionId.',
    auth: 'Customer Bearer'
  },
  // Users
  'GET /api/v1/users/me': {
    title: 'Get Current User Profile',
    feature: 'ProfileTab / AuthController._loadUserSession()',
    desc: 'Fetches the authenticated user profile, plan tier, roles, notification flags, and account status.',
    auth: 'Customer Bearer'
  },
  'PATCH /api/v1/users/me': {
    title: 'Update User Profile Details',
    feature: 'AccountSettingsScreen',
    desc: 'Updates user display name, phone number, location, and country.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/users/me': {
    title: 'Delete User Account',
    feature: 'AccountSettingsScreen (Close Account)',
    desc: 'Permanently deletes user account and revokes active sessions.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/users/me/dark-mode': {
    title: 'Get Dark Mode Setting',
    feature: 'AppTheme / PrefManager.isDarkMode',
    desc: 'Fetches the stored dark mode theme preference.',
    auth: 'Customer Bearer'
  },
  'PATCH /api/v1/users/me/dark-mode': {
    title: 'Toggle Dark Mode Setting',
    feature: 'ProfileTab (Dark Theme Toggle)',
    desc: 'Persists user dark mode preference on the server.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/users/me/preferences': {
    title: 'Get Currency & Display Preferences',
    feature: 'ProfileTab (Currency / Unit settings)',
    desc: 'Returns preferences such as currency (USD, EUR, GBP) and date formats.',
    auth: 'Customer Bearer'
  },
  'PATCH /api/v1/users/me/preferences': {
    title: 'Update Currency & Display Preferences',
    feature: 'ProfileTab (Currency / Unit settings)',
    desc: 'Updates preferred currency or regional display preferences.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/users/me/avatar/upload-url': {
    title: 'Request S3 Presigned URL for Avatar',
    feature: 'ProfileTab (Avatar Upload)',
    desc: 'Generates a secure presigned S3 upload URL for direct profile avatar uploads.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/users/me/avatar/confirm': {
    title: 'Confirm Avatar Upload',
    feature: 'ProfileTab (Avatar Upload Confirmation)',
    desc: 'Confirms that the uploaded avatar image was stored in S3 and updates the profile image URL.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/users/me/avatar': {
    title: 'Remove Avatar Image',
    feature: 'ProfileTab (Remove Avatar)',
    desc: 'Deletes the current user avatar and resets to default initials badge.',
    auth: 'Customer Bearer'
  },
  // Search
  'GET /api/v1/search': {
    title: 'Multi-Platform Aggregated Search',
    feature: 'SearchTab / WatchSearchController.executeSearch()',
    desc: 'Core aggregated search engine across eBay, Chrono24, and Grailzee. Supports keywords (brand, model, title), platform toggles, price range (min/max), manufacturing year filters (min/max), condition, location, timeRange, and sold vs active listings.',
    auth: 'Customer Bearer (or Public with rate limit)'
  },
  'GET /api/v1/search/suggestions': {
    title: 'Search Autocomplete Suggestions',
    feature: 'SearchTab (Search Bar Predictive Autocomplete)',
    desc: 'Provides fast autocomplete suggestions as the user types in the search bar.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/search/popular': {
    title: 'Popular & Trending Search Queries',
    feature: 'SearchTab (Trending Search Pills / Chips)',
    desc: 'Returns top trending luxury watch search queries (e.g., Rolex Daytona, Patek 5711, Speedmaster).',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/search/recent': {
    title: 'Get Recent User Search Queries',
    feature: 'SearchTab / WatchSearchController.loadSearchHistory()',
    desc: 'Retrieves user recent search history keywords from the cloud.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/search/recent': {
    title: 'Clear Recent Search History',
    feature: 'SearchTab / WatchSearchController.clearHistory()',
    desc: 'Clears user search query history.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/search/facets': {
    title: 'Get Search Facets & Counts',
    feature: 'SearchTab (Filter Drawer & Counts)',
    desc: 'Returns available filter facets, brands, condition distributions, and price histograms for current query.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/search/preview-count': {
    title: 'Preview Search Matches Count',
    feature: 'SearchTab (Filter Drawer Apply Button Count Preview)',
    desc: 'Calculates the number of matching listings before the user applies complex filter options.',
    auth: 'Customer Bearer'
  },
  // Image search
  'POST /api/v1/image-search/upload-url': {
    title: 'Request Presigned URL for Watch Image',
    feature: 'ImageSearchScreen / Camera Upload',
    desc: 'Generates a secure presigned upload URL for camera or gallery watch photo uploads.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/image-search': {
    title: 'Execute Visual Similarity Watch Search',
    feature: 'ImageSearchScreen / WatchSearchController.runSimulatedImageSearch()',
    desc: 'Triggers visual embedding vector search to match the watch dial, bezel, and case with marketplace listings.',
    auth: 'Customer Bearer (Paid Plan / Premium feature)'
  },
  'GET /api/v1/image-search/recent': {
    title: 'Get Recent Image Searches',
    feature: 'ImageSearchScreen (Recent Visual Scans)',
    desc: 'Lists previously uploaded watch image searches with thumbnails.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/image-search/:searchId': {
    title: 'Get Image Search Details',
    feature: 'ImageSearchScreen',
    desc: 'Retrieves classification details, confidence scores, and identified watch models for an image scan.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/image-search/:searchId/results': {
    title: 'Get Image Search Matched Listings',
    feature: 'ImageSearchScreen Results Grid',
    desc: 'Returns marketplace listings ranked by visual similarity distance score.',
    auth: 'Customer Bearer'
  },
  // Saved searches
  'GET /api/v1/saved-searches': {
    title: 'Get User Saved Searches',
    feature: 'BookmarksTab / BookmarkController.fetchSavedSearches()',
    desc: 'Fetches saved search cards with filter parameters, active platforms, chip pills, and alert badges.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/saved-searches': {
    title: 'Save Current Search Query & Filters',
    feature: 'BookmarksTab / BookmarkController.saveSearch()',
    desc: 'Bookmarks a query along with JSON filter criteria (platforms, price, year, condition).',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/saved-searches/:savedSearchId/run': {
    title: 'Run Saved Search',
    feature: 'BookmarksTab (Tap Saved Search Card to Run)',
    desc: 'Executes the saved search parameters and returns matching listings instantly.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/saved-searches/:savedSearchId/alerts/enable': {
    title: 'Enable Alerts on Saved Search',
    feature: 'BookmarksTab (Price Drop / New Listing Alert Toggle)',
    desc: 'Subscribes the user to background price drop and new listing notifications for this saved query.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/saved-searches/:savedSearchId/alerts/disable': {
    title: 'Disable Alerts on Saved Search',
    feature: 'BookmarksTab (Price Drop / New Listing Alert Toggle)',
    desc: 'Unsubscribes from push notifications for this saved search.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/saved-searches/:savedSearchId': {
    title: 'Delete Saved Search',
    feature: 'BookmarksTab / BookmarkController.removeSavedSearch()',
    desc: 'Deletes a bookmarked search.',
    auth: 'Customer Bearer'
  },
  // Bookmarks
  'POST /api/v1/listings/:listingId/save': {
    title: 'Bookmark / Save Watch Listing',
    feature: 'WatchDetailScreen / BookmarkController.toggleBookmark()',
    desc: 'Saves a watch listing to user bookmarks collection.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/listings/:listingId/save': {
    title: 'Remove Bookmark / Unsave Listing',
    feature: 'WatchDetailScreen / BookmarkController.toggleBookmark()',
    desc: 'Removes a watch listing from user bookmarks collection.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/me/saved-listings': {
    title: 'Get All Bookmarked Listings',
    feature: 'BookmarksTab / BookmarkController.fetchBookmarks()',
    desc: 'Returns all saved watch cards with current pricing and platform badges.',
    auth: 'Customer Bearer'
  },
  // Watch Detail
  'GET /api/v1/listings/:listingId': {
    title: 'Get Watch Listing Detail',
    feature: 'WatchDetailScreen',
    desc: 'Fetches comprehensive listing details, high-res photos, specifications, condition, year, and seller metadata.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/listings/:listingId/price-history': {
    title: 'Get Listing Price History',
    feature: 'WatchDetailScreen (CustomPriceChart trend curve)',
    desc: 'Historical price changes recorded for this listing over time.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/listings/:listingId/similar': {
    title: 'Get Similar Watch Listings',
    feature: 'WatchDetailScreen (Similar Watches Carousel)',
    desc: 'Fetches comparable listings of the same model and reference number across platforms.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/listings/:listingId/seller': {
    title: 'Get Listing Seller Profile',
    feature: 'WatchDetailScreen (Verified Trader Card)',
    desc: 'Returns seller rating, completed deals count, verified badge, and location.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/listings/:listingId/outbound-link': {
    title: 'Get Marketplace Outbound Redirect Link',
    feature: 'WatchDetailScreen._simulatePlatformRedirect()',
    desc: 'Generates audited tracking redirect link to external platform (eBay, Chrono24, Grailzee).',
    auth: 'Customer Bearer'
  },
  // Analytics
  'GET /api/v1/watch-models/:watchModelId/market-summary': {
    title: 'Get Model Market Summary (Low/High/Avg)',
    feature: 'WatchDetailScreen & SearchTab (Market Summary Stats)',
    desc: 'Calculates the lowest price, highest price, average market value, and spread for a watch model.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/analytics/watch-models/:watchModelId/price-trend': {
    title: 'Get Watch Model Monthly Price Trends',
    feature: 'WatchDetailScreen (CustomPriceChart Vector Curves)',
    desc: 'Returns monthly index price trajectory points for rendering cubic Bezier charts.',
    auth: 'Customer Bearer'
  },
  // Notifications
  'GET /api/v1/notifications': {
    title: 'Get Notifications Feed',
    feature: 'AlertsTab & NotificationsScreen / AlertController.fetchAlerts()',
    desc: 'Fetches notifications for price drops, new listings, and sale alerts.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/notifications/unread-count': {
    title: 'Get Unread Notifications Count',
    feature: 'CustomNavbar (Red Notification Badge) / AlertController.unreadCount',
    desc: 'Returns unread notification badge count.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/notifications/:notificationId/read': {
    title: 'Mark Notification as Read',
    feature: 'AlertsTab / AlertController.markAsRead()',
    desc: 'Marks a single notification item as read.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/notifications/read-all': {
    title: 'Mark All Notifications as Read',
    feature: 'AlertsTab / AlertController.markAllAsRead()',
    desc: 'Marks all notifications in user feed as read.',
    auth: 'Customer Bearer'
  },
  // Peer marketplace
  'GET /api/v1/trader-collection': {
    title: 'Get Peer Trader Listings',
    feature: 'TradersCollectionsScreen / WatchSearchController.getTraderListings()',
    desc: 'Fetches peer-to-peer watch listings published in-app by verified collectors.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/listings': {
    title: 'Create In-App Watch Listing',
    feature: 'MyListingsScreen._showAddListingSheet()',
    desc: 'Submits a new luxury watch listing with brand, model, title, price, year, condition, and location.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/orders': {
    title: 'Create Purchase Order (Buy Watch)',
    feature: 'WatchDetailScreen._showBuyConfirmSheet()',
    desc: 'Initiates a peer-to-peer purchase order for an in-app watch listing and notifies the seller.',
    auth: 'Customer Bearer'
  },
  // Subscriptions
  'GET /api/v1/subscriptions/plans': {
    title: 'List Subscription Plans (Free & Paid)',
    feature: 'SubscriptionPlansScreen / Pricing Cards',
    desc: 'Lists available subscription tiers (Free, Premium, VIP) with features, prices, and limits.',
    auth: 'Public / Customer'
  },
  'GET /api/v1/subscriptions/me': {
    title: 'Get Current User Subscription',
    feature: 'ProfileTab (Current Plan Gauge) / AuthController.currentUser.plan',
    desc: 'Returns user active subscription tier, renewal date, and billing status.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/subscriptions/me/usage': {
    title: 'Check Monthly Search Quota (5/mo Free)',
    feature: 'WatchSearchController.checkSearchLimit()',
    desc: 'Returns monthly search consumption and remaining quota for Free tier accounts.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/subscriptions/checkout-session': {
    title: 'Create Stripe Checkout Session',
    feature: 'SubscriptionPlansScreen (Upgrade to Premium)',
    desc: 'Creates a Stripe Checkout Session for subscription payment.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/subscriptions/change-plan': {
    title: 'Change / Upgrade Subscription Plan',
    feature: 'AuthController.upgradePlan() / downgradePlan()',
    desc: 'Upgrades or downgrades user subscription plan tier.',
    auth: 'Customer Bearer'
  },
  // Admin
  'POST /api/v1/admin/auth/login': {
    title: 'Admin Panel Login',
    feature: 'AdminDashboard / AuthController',
    desc: 'Authenticates administrator credentials and grants administrative JWT token.',
    auth: 'Admin Public'
  },
  'GET /api/v1/admin/dashboard/summary': {
    title: 'Get Admin Dashboard Summary Metrics',
    feature: 'AdminDashboard (Top Metric Gauges)',
    desc: 'Returns aggregated user counts, active sessions, monthly recurring revenue, and search counts.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/users': {
    title: 'Admin List All Users',
    feature: 'AdminDashboard / AdminController.fetchUsers()',
    desc: 'Returns paginated list of all registered platform users, roles, and status.',
    auth: 'Admin Bearer'
  },
  'PATCH /api/v1/admin/users/:userId/status': {
    title: 'Admin Update User Status / Deactivate',
    feature: 'AdminDashboard / AdminController.updateUser()',
    desc: 'Allows admin to activate, suspend, or deactivate user accounts.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/marketplaces': {
    title: 'Admin List Marketplace Integrations',
    feature: 'AdminDashboard (eBay, Chrono24, Grailzee Toggles)',
    desc: 'Returns status and sync health for connected marketplaces.',
    auth: 'Admin Bearer'
  },
  'POST /api/v1/admin/marketplaces/:marketplaceId/enable': {
    title: 'Admin Enable Marketplace Integration',
    feature: 'AdminDashboard / AdminController.toggleEbay() etc.',
    desc: 'Globally activates marketplace scraping and ingestion.',
    auth: 'Admin Bearer'
  },
  'POST /api/v1/admin/marketplaces/:marketplaceId/disable': {
    title: 'Admin Disable Marketplace Integration',
    feature: 'AdminDashboard / AdminController.toggleEbay() etc.',
    desc: 'Globally disables marketplace scraping and ingestion.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/settings/features': {
    title: 'Admin List Platform Feature Toggles',
    feature: 'AdminDashboard (Image Search & Ads Toggles)',
    desc: 'Retrieves global feature toggles (image search, ads, volatility cron).',
    auth: 'Admin Bearer'
  },
  'PATCH /api/v1/admin/settings/features/:featureKey': {
    title: 'Admin Update Platform Feature Toggle',
    feature: 'AdminDashboard / AdminController.toggleImageSearch() / toggleAds()',
    desc: 'Enables or disables platform features dynamically without redeploying.',
    auth: 'Admin Bearer'
  },
  // eBay Customer & Dealer Integration
  'GET /api/v1/ebay/connect': {
    title: 'Get eBay OAuth URL / Initiate Connection',
    feature: 'ProfileTab (Connect eBay Button) / EbayApiService.connect()',
    desc: 'Returns the eBay User Consent OAuth URL. When opened, the user authorizes The Watch Box to manage their listings.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/ebay/status': {
    title: 'Check eBay Account Connection Status',
    feature: 'ProfileTab (eBay Status Badge) / EbayApiService.getStatus()',
    desc: 'Returns whether the current customer has an active, valid eBay OAuth token, eBay username, and expiration.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/ebay/disconnect': {
    title: 'Disconnect eBay Account',
    feature: 'ProfileTab (Disconnect eBay Dialog)',
    desc: 'Revokes the stored eBay OAuth credentials for this customer and disconnects their account.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/ebay/oauth/callback': {
    title: 'eBay OAuth Callback Receiver',
    feature: 'DeepLink / Webhook Callback',
    desc: 'Public OAuth redirect URL where eBay sends the authorization code upon user consent. Exchanges code for token.',
    auth: 'Public'
  },
  'GET /api/v1/ebay/oauth/declined': {
    title: 'eBay OAuth Declined Handler',
    feature: 'DeepLink / OAuth Cancellation',
    desc: 'Receives redirect when user declines eBay authorization consent.',
    auth: 'Public'
  },
  'POST /api/v1/dealer/listings/:listingId/publish-to-ebay': {
    title: 'Publish Watch Listing to eBay Marketplace',
    feature: 'ListingDetailScreen (Sync to eBay Button)',
    desc: 'Pushes an in-app watch listing to eBay as an active inventory item using eBay Inventory & Merchant APIs.',
    auth: 'Customer Bearer (Dealer)'
  },
  // Marketplaces Aggregated Search & eBay Integration
  'GET /api/v1/marketplaces/search': {
    title: 'Multi-Marketplace Unified Search',
    feature: 'SearchTab / WatchSearchController',
    desc: 'Aggregates search results across eBay, Chrono24, and internal inventory simultaneously.',
    auth: 'Customer Bearer (or Public with rate limit)'
  },
  'GET /api/v1/marketplaces/ebay/search': {
    title: 'eBay Real-Time Marketplace Search',
    feature: 'SearchTab (eBay Filter Checked)',
    desc: 'Queries eBay Browse API in real-time with filters for brand, model, price, condition, and currency.',
    auth: 'Customer Bearer / Public'
  },
  'POST /api/v1/marketplaces/ebay/search-by-location': {
    title: 'eBay Proximity / Radius Search',
    feature: 'SearchTab (Near Me Filter / Location Radius)',
    desc: 'Finds eBay watch listings within a specific geographic coordinate radius (latitude, longitude, radiusMiles).',
    auth: 'Customer Bearer / Public'
  },
  'GET /api/v1/marketplaces/ebay/analytics': {
    title: 'eBay Pricing Analytics & Market Velocity',
    feature: 'PriceAnalyticsTab (eBay Market Trend Chart)',
    desc: 'Calculates average sale price, volume, and days-on-market for watches sold on eBay.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/ebay/seller-verification': {
    title: 'Verify eBay Seller Trust & Feedback Score',
    feature: 'ListingDetailScreen (Seller Reputation Card)',
    desc: 'Fetches seller positive feedback percentage, total feedback score, and verified dealer badges.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/ebay/market-insights': {
    title: 'eBay Luxury Watch Market Insights',
    feature: 'MarketplaceInsightsScreen / Daily Watch Report',
    desc: 'Summarizes high-demand luxury watch models, price fluctuations, and trading liquidity on eBay.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/marketplaces/ebay/listings/:listingId/share': {
    title: 'Share Listing to eBay External Channel',
    feature: 'ListingDetailScreen (Share Options)',
    desc: 'Generates affiliate share link or exports listing details directly to eBay.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/ebay/connection': {
    title: 'Test eBay API Gateway Health & Token',
    feature: 'System Probe / Diagnostic',
    desc: 'Verifies backend connectivity with eBay Developer Sandbox/Production endpoints.',
    auth: 'Customer Bearer / Admin'
  },
  // Chrono24 Marketplace Integration
  'GET /api/v1/marketplaces/chrono24/search': {
    title: 'Chrono24 Direct Listing Search',
    feature: 'SearchTab (Chrono24 Filter Checked)',
    desc: 'Searches luxury watch listings on Chrono24 with price, condition, year, and location filters.',
    auth: 'Customer Bearer / Public'
  },
  'POST /api/v1/marketplaces/chrono24/search': {
    title: 'Chrono24 Visual Image Search',
    feature: 'SearchTab (Visual Image Search -> Chrono24)',
    desc: 'Uploads watch photo to find matching luxury listings on Chrono24.',
    auth: 'Customer Bearer / Public'
  },
  'POST /api/v1/marketplaces/chrono24/search-by-location': {
    title: 'Chrono24 Location & Regional Dealer Search',
    feature: 'SearchTab (Nearby Chrono24 Dealers)',
    desc: 'Finds Chrono24 verified dealer listings within geographic coordinates.',
    auth: 'Customer Bearer / Public'
  },
  'GET /api/v1/marketplaces/chrono24/analytics': {
    title: 'Chrono24 Watch Price Index Analytics',
    feature: 'PriceAnalyticsTab (Chrono24 Benchmark)',
    desc: 'Provides Chrono24 market trends, valuation historical charts, and price performance indices.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/chrono24/market-insights': {
    title: 'Chrono24 Global Market Insights',
    feature: 'MarketplaceInsightsScreen',
    desc: 'Returns global market demand, brand market share, and fast-moving reference numbers on Chrono24.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/chrono24/products/:id/similar': {
    title: 'Chrono24 Similar Reference Watches',
    feature: 'WatchDetailScreen (More Like This Carousel)',
    desc: 'Returns similar watch models based on brand, dial color, and price segment from Chrono24.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/chrono24/products/:id/recommendations': {
    title: 'Chrono24 AI Recommendations',
    feature: 'WatchDetailScreen (Collector Recommendations)',
    desc: 'Curated list of complementary watches and alternative models from Chrono24.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/marketplaces/chrono24/products/:id': {
    title: 'Chrono24 Full Product Details',
    feature: 'WatchDetailScreen (External Chrono24 Card)',
    desc: 'Fetches detailed watch specifications (case size, movement, box/papers) from Chrono24.',
    auth: 'Customer Bearer'
  },
  // AI & Visual Search
  'POST /api/v1/ai/analyze-image': {
    title: 'AI Watch Vision Analyzer (Dial, Bezel, Hands)',
    feature: 'VisualSearchScreen / CameraAIController',
    desc: 'Sends watch photo to Gemini AI Vision to detect brand, model, dial color, reference number, and authenticity indicators.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/ai/search': {
    title: 'AI Multi-Platform Image Search',
    feature: 'VisualSearchScreen (Scan & Search)',
    desc: 'Combines AI vision extraction with multi-marketplace aggregated queries across eBay and Chrono24.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/image-search/ebay-direct': {
    title: 'Direct eBay Image Similarity Search',
    feature: 'VisualSearchScreen (eBay Tab)',
    desc: 'Direct visual similarity search targeting eBay Image Search API.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/image-search/marketplaces-direct': {
    title: 'Direct Multi-Marketplace Visual Search',
    feature: 'VisualSearchScreen (All Platforms Tab)',
    desc: 'Searches multiple external marketplaces simultaneously using uploaded watch photograph.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/image-search/visual': {
    title: 'Visual Feature Vector Embedding Search',
    feature: 'VisualSearchScreen',
    desc: 'Matches visual embedding vectors against internal watch catalog database.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/products/:source/:productId/details': {
    title: 'Get Unified External Product Details',
    feature: 'WatchDetailScreen (Cross-Platform Inspector)',
    desc: 'Fetches normalized watch details from any external source (ebay, chrono24, grailzee).',
    auth: 'Customer Bearer'
  },
  // User Profile
  'GET /api/v1/users/nearby': {
    title: 'Find Nearby Watch Collectors & Dealers',
    feature: 'CommunityScreen / Location Filter',
    desc: 'Finds watch enthusiasts and verified dealers located in the same city or radius.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/users/me/avatar': {
    title: 'Get User Avatar Image URL',
    feature: 'ProfileTab (Avatar Image Loader)',
    desc: 'Returns the direct URL and cloud storage key of the user profile avatar.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/users/me/avatar': {
    title: 'Upload Profile Avatar (Direct Multipart/Form-Data)',
    feature: 'ProfileTab (Pick Image from Gallery / Camera)',
    desc: 'Direct multipart upload of user profile image. Resizes and stores in S3/Cloud Storage.',
    auth: 'Customer Bearer'
  },
  // Saved Products
  'GET /api/v1/saved-products': {
    title: 'List User Saved Watch Products',
    feature: 'SavedTab / BookmarksList',
    desc: 'Returns all saved external and internal watch listings for the authenticated user.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/saved-products': {
    title: 'Save Watch Product to Bookmarks',
    feature: 'WatchDetailScreen / Heart Button',
    desc: 'Bookmarks a watch from eBay, Chrono24, or trader listing into user saved collection.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/recommended-products': {
    title: 'Get Personalized Watch Recommendations',
    feature: 'HomeTab (Recommended for You Reel)',
    desc: 'Returns AI-recommended watch listings based on user saved items and recent searches.',
    auth: 'Customer Bearer'
  },
  // Direct In-App Subscriptions
  'GET /api/v1/subscription/plans': {
    title: 'Get Available Subscription Plans',
    feature: 'SubscriptionPlansScreen',
    desc: 'Returns subscription plans with pricing, feature list, and Stripe Price IDs.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/subscription': {
    title: 'Get Active Subscription Status',
    feature: 'ProfileTab / Subscription Status Gauge',
    desc: 'Returns customer current subscription plan, status (active, canceled), and renewal date.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/subscription/checkout': {
    title: 'Initiate Stripe Subscription Checkout',
    feature: 'SubscriptionPlansScreen (Subscribe Button)',
    desc: 'Creates a Stripe Checkout Session for subscription upgrades.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/subscription/portal': {
    title: 'Create Stripe Customer Billing Portal Session',
    feature: 'ProfileTab (Manage Billing / Invoices)',
    desc: 'Generates a Stripe Customer Portal link where user can manage credit cards and invoices.',
    auth: 'Customer Bearer'
  },
  // Payments & Orders
  'GET /api/v1/payments/config': {
    title: 'Get Public Stripe Configuration',
    feature: 'StripePaymentSheet / AppInit',
    desc: 'Returns Stripe publishable key and supported payment currencies.',
    auth: 'Public'
  },
  'GET /api/v1/payments/products/:productId/status': {
    title: 'Check Product Payment & Escrow Status',
    feature: 'ListingDetailScreen (Buy Now / Reserved Status)',
    desc: 'Checks if an item has a pending payment or is reserved by another buyer.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/payments/products/:productId/payment-intent': {
    title: 'Create Direct Product Payment Intent',
    feature: 'BuyNowSheet / PaymentController',
    desc: 'Creates a Stripe PaymentIntent for instant watch listing purchase.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/orders/:orderId/confirm-payment': {
    title: 'Confirm Order Payment Fulfillment',
    feature: 'OrderSuccessScreen',
    desc: 'Confirms that the buyer payment intent succeeded and places the order into Escrow.',
    auth: 'Customer Bearer'
  },
  // Watch Alerts
  'POST /api/v1/watch-alerts': {
    title: 'Create Real-Time Watch Price Alert',
    feature: 'WatchAlertsScreen (Create New Alert Dialog)',
    desc: 'Sets up a background monitoring trigger for a specific brand/model below a target price.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/watch-alerts': {
    title: 'List Active Watch Price Alerts',
    feature: 'WatchAlertsScreen / AlertsListView',
    desc: 'Returns all configured price drop alerts for the user.',
    auth: 'Customer Bearer'
  },
  'DELETE /api/v1/watch-alerts/:alertId': {
    title: 'Delete Watch Price Alert',
    feature: 'WatchAlertsScreen (Swipe to Delete)',
    desc: 'Removes a price alert trigger.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/watch-alerts/run': {
    title: 'Trigger Instant Alert Match Scan',
    feature: 'WatchAlertsScreen (Manual Refresh / Sync)',
    desc: 'Forces immediate scan of eBay and marketplace inventory for price alert matches.',
    auth: 'Customer Bearer'
  },
  'GET /api/v1/watch-alert-events': {
    title: 'List Watch Alert Trigger History',
    feature: 'WatchAlertsScreen (Alert History Log)',
    desc: 'Returns recent notifications generated by price alert matches.',
    auth: 'Customer Bearer'
  },
  // Listing Images
  'GET /api/v1/listings/:listingId/images': {
    title: 'List Images for Watch Listing',
    feature: 'CreateListingScreen (Photo Gallery)',
    desc: 'Lists all uploaded photos, thumbnails, and display order for a watch listing.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/listings/:listingId/images': {
    title: 'Upload Listing Photo (Multipart/Form-Data)',
    feature: 'CreateListingScreen (Add Photo)',
    desc: 'Direct multipart upload of a watch photograph to a listing.',
    auth: 'Customer Bearer'
  },
  'POST /api/v1/listings/:listingId/images/upload': {
    title: 'Upload Listing Photo Alternative Endpoint',
    feature: 'CreateListingScreen (Add Photo)',
    desc: 'Alias for listing photo multipart upload.',
    auth: 'Customer Bearer'
  },
  // Webhooks
  'GET /api/v1/webhooks/ebay': {
    title: 'eBay Marketplace Deletion / Challenge Verification',
    feature: 'eBay Webhook Infrastructure',
    desc: 'Responds to eBay automated cryptographic challenge hash for webhook endpoint verification.',
    auth: 'Public'
  },
  // Admin Extensions
  'POST /api/v1/admin/auth/register': {
    title: 'Register New Administrator Account',
    feature: 'Admin Panel Initial Setup',
    desc: 'Registers initial superadmin or requires existing admin privilege to provision staff accounts.',
    auth: 'Admin Bearer / Setup'
  },
  'POST /api/v1/admin/settings/content/images': {
    title: 'Admin Upload Content / CMS Image',
    feature: 'Admin CMS (Article & Page Image Upload)',
    desc: 'Uploads banners and illustrations used in mobile app terms, privacy, and guide pages.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/subscriptions/settings': {
    title: 'Get Global Subscription System Settings',
    feature: 'Admin Panel (Subscription Configuration)',
    desc: 'Returns Stripe live/test mode flags, default trial periods, and currency configs.',
    auth: 'Admin Bearer'
  },
  'PATCH /api/v1/admin/subscriptions/settings': {
    title: 'Update Global Subscription System Settings',
    feature: 'Admin Panel (Subscription Configuration)',
    desc: 'Updates trial lengths, currency toggles, and webhook secret settings.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/subscriptions/actions': {
    title: 'Get Subscription Audit Actions',
    feature: 'Admin Panel (Billing Audit Trail)',
    desc: 'Returns timeline of subscription upgrades, downgrades, cancellations, and manual grants.',
    auth: 'Admin Bearer'
  },
  'GET /api/v1/admin/bulk-email/recipients': {
    title: 'List Eligible Bulk Email Recipients',
    feature: 'Admin Panel (Campaign Audience Builder)',
    desc: 'Filters user lists by tier, activity, and notification opt-ins for email blasts.',
    auth: 'Admin Bearer'
  },
  // System Health
  'GET /health': {
    title: 'System Health Check & Uptime Probe',
    feature: 'Load Balancer / Monitoring',
    desc: 'Returns HTTP 200 with server status and uptime in seconds.',
    auth: 'Public'
  },
  'GET /health/live': {
    title: 'Kubernetes Liveness Probe',
    feature: 'DevOps / Kubernetes Liveness',
    desc: 'Confirms that the Node.js process is responsive.',
    auth: 'Public'
  },
  'GET /health/ready': {
    title: 'Kubernetes Readiness Probe (Mongo, Redis, RabbitMQ)',
    feature: 'DevOps / Kubernetes Readiness',
    desc: 'Performs round-trip ping checks to MongoDB, Redis, and RabbitMQ to confirm service readiness.',
    auth: 'Public'
  },
  'GET /internal': {
    title: 'Internal API Service Metadata',
    feature: 'Internal Service Discovery',
    desc: 'Returns internal API name and version.',
    auth: 'Public'
  },
  'GET /api/v1': {
    title: 'Customer API Gateway Root',
    feature: 'API Gateway Discovery',
    desc: 'Returns API metadata, status, and version.',
    auth: 'Public'
  },
  'GET /api/v1/admin': {
    title: 'Admin API Gateway Root',
    feature: 'Admin Gateway Discovery',
    desc: 'Returns Admin API metadata, status, and version.',
    auth: 'Public'
  }
};

function getFolderForPath(method, fullPath) {
  const p = fullPath.replace('{{baseUrl}}', '');
  
  // 17. System Health & Gateway Probes
  if (p.startsWith('/health') || p.startsWith('/internal') || p === '/api/v1' || p === '/api/v1/admin') {
    return ['17. System Health & Gateway', '17.1 Health & Service Probes'];
  }

  // 14. Admin Panel & Controls
  if (p.startsWith('/api/v1/admin')) {
    if (p.startsWith('/api/v1/admin/auth')) return ['14. Admin Panel & Controls', '14.1 Admin Authentication'];
    if (p.startsWith('/api/v1/admin/dashboard')) return ['14. Admin Panel & Controls', '14.2 Dashboard Analytics & Metrics'];
    if (p.startsWith('/api/v1/admin/users')) return ['14. Admin Panel & Controls', '14.3 User Management'];
    if (p.startsWith('/api/v1/admin/administrators')) return ['14. Admin Panel & Controls', '14.4 Administrators & RBAC Roles'];
    if (p.startsWith('/api/v1/admin/subscriptions')) return ['14. Admin Panel & Controls', '14.5 Plans & Pricing Management'];
    if (p.startsWith('/api/v1/admin/earnings')) return ['14. Admin Panel & Controls', '14.6 Financial Earnings & Billing Logs'];
    if (p.startsWith('/api/v1/admin/marketplaces')) return ['14. Admin Panel & Controls', '14.7 Marketplace Integration Controls'];
    if (p.startsWith('/api/v1/admin/campaigns') || p.startsWith('/api/v1/admin/bulk-email')) return ['14. Admin Panel & Controls', '14.8 Social Campaigns & Bulk Email'];
    if (p.startsWith('/api/v1/admin/support') || p.startsWith('/api/v1/admin/settings/content')) return ['14. Admin Panel & Controls', '14.9 Support Tickets & Content Management'];
    if (p.startsWith('/api/v1/admin/settings')) return ['14. Admin Panel & Controls', '14.10 Feature Toggles & System Settings'];
    return ['14. Admin Panel & Controls', '14.11 Audit Logs & Monitoring'];
  }

  // 15. Platform Webhooks
  if (p.startsWith('/api/v1/webhooks')) {
    return ['15. Platform Webhooks', '15.1 Webhook Receivers'];
  }

  // 16. eBay & External Marketplaces
  if (
    p.startsWith('/api/v1/ebay') ||
    p.startsWith('/api/v1/dealer') ||
    p.startsWith('/api/v1/marketplaces/ebay') ||
    p.startsWith('/api/v1/marketplaces/chrono24') ||
    p === '/api/v1/marketplaces/search' ||
    p === '/api/v1/image-search/ebay-direct'
  ) {
    if (p.startsWith('/api/v1/ebay') || p.startsWith('/api/v1/dealer') || p === '/api/v1/marketplaces/ebay/connection') {
      return ['16. eBay & External Marketplaces', '16.1 eBay Account OAuth & Dealer Sync'];
    }
    if (p.startsWith('/api/v1/marketplaces/ebay') || p === '/api/v1/image-search/ebay-direct') {
      return ['16. eBay & External Marketplaces', '16.2 eBay Aggregated Search & Analytics'];
    }
    if (p.startsWith('/api/v1/marketplaces/chrono24')) {
      return ['16. eBay & External Marketplaces', '16.3 Chrono24 Marketplace & Listings'];
    }
    return ['16. eBay & External Marketplaces', '16.4 Unified Marketplace Search'];
  }

  // 01. Authentication & Sessions
  if (p.startsWith('/api/v1/auth')) {
    return ['01. Authentication & Sessions', '01.1 Customer Auth'];
  }

  // 02. User Profile & Preferences
  if (p.startsWith('/api/v1/users')) {
    return ['02. User Profile & Preferences', '02.1 Profile & Settings'];
  }

  // 03. Search & Discovery
  if (p.startsWith('/api/v1/search')) {
    return ['03. Search & Discovery', '03.1 Aggregated Search'];
  }

  // 04. Image Search & AI Detection
  if (p.startsWith('/api/v1/ai') || p.includes('/auto-detect') || p.startsWith('/api/v1/products/')) {
    return ['04. Image Search & AI Detection', '04.2 AI Watch Analyzer & Auto-Detect'];
  }
  if (p.startsWith('/api/v1/image-search')) {
    return ['04. Image Search & AI Detection', '04.1 Visual Similarity Search'];
  }

  // 08. Saved Searches & Search Alerts
  if (p.startsWith('/api/v1/watch-alerts') || p.startsWith('/api/v1/watch-alert-events')) {
    return ['08. Saved Searches & Search Alerts', '08.2 Watch Price Alerts & Automated Matching'];
  }
  if (p.startsWith('/api/v1/saved-searches')) {
    return ['08. Saved Searches & Search Alerts', '08.1 Saved Search Queries'];
  }

  // 07. Bookmarks & Watchlists
  if (p.startsWith('/api/v1/saved-products') || p.startsWith('/api/v1/recommended-products')) {
    return ['07. Bookmarks & Watchlists', '07.2 Saved Products & Recommended'];
  }
  if (p.startsWith('/api/v1/watchlists') || p.endsWith('/save') || p.includes('/save') || p.startsWith('/api/v1/me/saved-listings')) {
    return ['07. Bookmarks & Watchlists', '07.1 Saved Listings & Watchlists'];
  }

  // 09. Notifications & Price Drop Alerts
  if (p.startsWith('/api/v1/notifications') || p.startsWith('/api/v1/notification-preferences') || p.startsWith('/api/v1/devices')) {
    return ['09. Notifications & Price Drop Alerts', '09.1 Push Notifications & Feeds'];
  }

  // 11. In-App Orders & Transactions
  if (p.startsWith('/api/v1/payments') || p.startsWith('/api/v1/orders') || p.startsWith('/api/v1/me/orders') || p.startsWith('/api/v1/sellers') || p.startsWith('/api/v1/reviews') || p.endsWith('/status')) {
    return ['11. In-App Orders & Transactions', '11.1 Orders & Payments'];
  }

  // 12. Subscriptions & Quota (5 Searches/mo Check)
  if (p.startsWith('/api/v1/subscriptions') || p.startsWith('/api/v1/subscription')) {
    return ['12. Subscriptions & Quota (5 Searches/mo Check)', '12.1 Plans & Quota Checks'];
  }

  // 10. Peer-to-Peer Marketplace & Trader Listings
  if (p.includes('/images') && p.startsWith('/api/v1/listings')) {
    return ['10. Peer-to-Peer Marketplace & Trader Listings', '10.2 Listing Photo Uploads & Galleries'];
  }
  if (p.startsWith('/api/v1/trader-collection') || p.startsWith('/api/v1/traders') || p.startsWith('/api/v1/me/listings') || p.startsWith('/api/v1/me/sales') || (p.startsWith('/api/v1/listings') && method !== 'GET')) {
    return ['10. Peer-to-Peer Marketplace & Trader Listings', '10.1 Trader Listings & Management'];
  }

  // 05. Watch Details & Catalog
  if (p.startsWith('/api/v1/brands') || p.startsWith('/api/v1/watch-models') || p.startsWith('/api/v1/marketplaces') || (p.startsWith('/api/v1/listings') && method === 'GET')) {
    if (p.includes('/outbound-link') || p.includes('/price-history') || p.includes('/similar') || p.includes('/seller') || p === '/api/v1/listings/{{listingId}}' || p === '/api/v1/listings/:listingId' || p === '/api/v1/listings') {
      return ['05. Watch Details & Catalog', '05.1 Catalog & Product Info'];
    }
    return ['05. Watch Details & Catalog', '05.2 Brands & Model Variants'];
  }

  // 06. Price Trend & Market Analytics
  if (p.startsWith('/api/v1/analytics') || p.startsWith('/api/v1/recommendations') || p.startsWith('/api/v1/portfolio')) {
    return ['06. Price Trend & Market Analytics', '06.1 Market Insights & Trends'];
  }

  // 13. Support, Content & Reports
  if (p.startsWith('/api/v1/support') || p.startsWith('/api/v1/reports') || p.startsWith('/api/v1/me/reports') || p.startsWith('/api/v1/content')) {
    return ['13. Support, Content & Reports', '13.1 Help & Static Content'];
  }

  return ['99. Miscellaneous', '99.1 General'];
}

// Build enriched postman items inside structured folders
const folderTree = {};

for (const item of raw.item) {
  const method = item.request.method;
  const rawUrl = item.request.url.raw || '';
  const pathStr = '/' + item.request.url.path.join('/');
  const normalizedKey = `${method} ${pathStr.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, ':$1')}`;

  const [topFolder, subFolder] = getFolderForPath(method, rawUrl);

  if (!folderTree[topFolder]) {
    folderTree[topFolder] = {};
  }
  if (!folderTree[topFolder][subFolder]) {
    folderTree[topFolder][subFolder] = [];
  }

  const meta = routeMeta[normalizedKey] || {};
  const isAuthPublic = meta.auth?.includes('Public') || rawUrl.includes('/login') || rawUrl.includes('/register') || rawUrl.includes('/refresh') || rawUrl.includes('forgot-password');
  const isAdmin = rawUrl.includes('/api/v1/admin');

  // Human friendly item name
  const displayTitle = meta.title ? `${method} ${pathStr} - ${meta.title}` : item.name;

  // Construct Markdown Documentation
  let doc = `### ${meta.title || item.name}\n\n`;
  if (meta.desc) {
    doc += `**Description:** ${meta.desc}\n\n`;
  } else {
    doc += `**Description:** Backend endpoint handling \`${method} ${pathStr}\`.\n\n`;
  }

  doc += `**Matching App Feature:** ${meta.feature || 'App Component / Service'}\n\n`;
  doc += `**Authorization:** \`${meta.auth || (isAdmin ? 'Admin Bearer ({{adminToken}})' : isAuthPublic ? 'Public' : 'Customer Bearer ({{accessToken}})')}\`\n\n`;

  // Headers
  doc += `#### Headers\n`;
  doc += `- \`Content-Type\`: \`application/json\`\n`;
  if (!isAuthPublic) {
    doc += `- \`Authorization\`: \`Bearer {{${isAdmin ? 'adminToken' : 'accessToken'}}}\`\n`;
  }
  doc += `\n`;

  // Path variables
  const pathVars = pathStr.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  if (pathVars && pathVars.length > 0) {
    doc += `#### Path Variables\n`;
    pathVars.forEach(v => {
      const varName = v.replace(/[\{\}]/g, '');
      doc += `- \`${varName}\`: Target resource identifier\n`;
    });
    doc += `\n`;
  }

  // Request body notes
  if (item.request.body && item.request.body.raw) {
    doc += `#### Request Body Schema\n\`\`\`json\n${item.request.body.raw}\n\`\`\`\n\n`;
  }

  // Expected Response
  if (item.response && item.response.length > 0) {
    const resp = item.response[0];
    doc += `#### Response (${resp.code} ${resp.status})\n\`\`\`json\n${resp.body}\n\`\`\`\n`;
  }

  // Inject Authorization Header in request if authenticated
  const headers = [...item.request.header];
  if (!isAuthPublic && !headers.some(h => h.key.toLowerCase() === 'authorization')) {
    headers.push({
      key: 'Authorization',
      value: `Bearer {{${isAdmin ? 'adminToken' : 'accessToken'}}}`,
      type: 'text'
    });
  }

  const enrichedItem = {
    ...item,
    name: displayTitle,
    request: {
      ...item.request,
      header: headers,
      description: doc
    }
  };

  folderTree[topFolder][subFolder].push(enrichedItem);
}

// Convert folder tree to Postman item structure
const postmanItems = [];

const sortedTopFolders = Object.keys(folderTree).sort();
for (const top of sortedTopFolders) {
  const subFolders = folderTree[top];
  const subItems = [];

  const sortedSubFolders = Object.keys(subFolders).sort();
  for (const sub of sortedSubFolders) {
    subItems.push({
      name: sub,
      item: subFolders[sub]
    });
  }

  postmanItems.push({
    name: top,
    description: `Endpoints and documentation for ${top}. Used by The Watch Box mobile app.`,
    item: subItems
  });
}

// Full Postman Collection object
const finalCollection = {
  info: {
    name: 'The Watch Box (WatchSphere) - Mobile App & Admin API Collection',
    _postman_id: 'watchbox-complete-api-v2',
    description: `# The Watch Box (WatchSphere) API Collection\n\nComprehensive Postman collection and API reference designed specifically for **The Watch Box** luxury watch marketplace mobile application (Flutter) and Admin Management dashboard.\n\n### Environment Variables\n- **\`baseUrl\`**: API base URL (Default: \`http://localhost:4000\`)\n- **\`accessToken\`**: Customer JWT access token\n- **\`refreshToken\`**: Customer JWT refresh token\n- **\`adminToken\`**: Admin JWT token\n- **\`listingId\`**: Target watch listing ID\n- **\`watchModelId\`**: Target watch model ID\n- **\`savedSearchId\`**: User saved search ID\n- **\`watchlistId\`**: User watchlist ID\n- **\`notificationId\`**: User notification alert ID\n- **\`orderId\`**: Peer order ID\n- **\`planId\`**: Subscription plan ID`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000', type: 'string' },
    { key: 'accessToken', value: '', type: 'string' },
    { key: 'refreshToken', value: '', type: 'string' },
    { key: 'adminToken', value: '', type: 'string' },
    { key: 'listingId', value: '64f000000000000000000001', type: 'string' },
    { key: 'watchModelId', value: '64f000000000000000000002', type: 'string' },
    { key: 'savedSearchId', value: '64f000000000000000000003', type: 'string' },
    { key: 'watchlistId', value: '64f000000000000000000004', type: 'string' },
    { key: 'notificationId', value: '64f000000000000000000005', type: 'string' },
    { key: 'orderId', value: '64f000000000000000000006', type: 'string' },
    { key: 'planId', value: '64f000000000000000000007', type: 'string' },
    { key: 'sessionId', value: '64f000000000000000000008', type: 'string' },
    { key: 'slug', value: 'rolex', type: 'string' },
    { key: 'traderId', value: '64f000000000000000000009', type: 'string' },
    { key: 'sellerId', value: '64f000000000000000000010', type: 'string' },
    { key: 'ticketId', value: '64f000000000000000000011', type: 'string' },
    { key: 'reportId', value: '64f000000000000000000012', type: 'string' },
    { key: 'campaignId', value: '64f000000000000000000013', type: 'string' },
    { key: 'marketplaceId', value: '64f000000000000000000014', type: 'string' },
    { key: 'productId', value: '64f000000000000000000015', type: 'string' },
    { key: 'source', value: 'ebay', type: 'string' },
    { key: 'searchId', value: '64f000000000000000000016', type: 'string' },
    { key: 'alertId', value: '64f000000000000000000017', type: 'string' },
    { key: 'promotionId', value: '64f000000000000000000018', type: 'string' },
    { key: 'transactionId', value: '64f000000000000000000019', type: 'string' },
    { key: 'paymentId', value: '64f000000000000000000020', type: 'string' },
    { key: 'adminId', value: '64f000000000000000000021', type: 'string' },
    { key: 'imageId', value: '64f000000000000000000022', type: 'string' },
    { key: 'portfolioItemId', value: '64f000000000000000000023', type: 'string' },
    { key: 'userId', value: '64f000000000000000000024', type: 'string' },
    { key: 'featureKey', value: 'enable_image_search', type: 'string' },
    { key: 'id', value: '1234567890', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'webhookSignature', value: '', type: 'string' }
  ],
  item: postmanItems
};

// Write out to all target destinations
const jsonContent = JSON.stringify(finalCollection, null, 2);

fs.writeFileSync(targetAppCollectionPath, jsonContent, 'utf8');
console.log(`Saved App collection to: ${targetAppCollectionPath}`);

fs.writeFileSync(targetBackendCollectionPath, jsonContent, 'utf8');
console.log(`Saved Backend root collection to: ${targetBackendCollectionPath}`);

fs.writeFileSync(targetBackendDocsPath, jsonContent, 'utf8');
console.log(`Saved Backend docs collection to: ${targetBackendDocsPath}`);

console.log('Collection build successful!');
