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
  }
};

function getFolderForPath(method, fullPath) {
  const p = fullPath.replace('{{baseUrl}}', '');
  
  if (p.startsWith('/api/v1/admin')) {
    if (p.startsWith('/api/v1/admin/auth')) return ['14. Admin Panel & Controls', '14.1 Admin Authentication'];
    if (p.startsWith('/api/v1/admin/dashboard')) return ['14. Admin Panel & Controls', '14.2 Dashboard Analytics & Metrics'];
    if (p.startsWith('/api/v1/admin/users')) return ['14. Admin Panel & Controls', '14.3 User Management'];
    if (p.startsWith('/api/v1/admin/subscriptions')) return ['14. Admin Panel & Controls', '14.4 Plans & Pricing Management'];
    if (p.startsWith('/api/v1/admin/marketplaces')) return ['14. Admin Panel & Controls', '14.5 Marketplace Integration Controls'];
    if (p.startsWith('/api/v1/admin/campaigns') || p.startsWith('/api/v1/admin/bulk-email')) return ['14. Admin Panel & Controls', '14.6 Social Campaigns & Automation'];
    if (p.startsWith('/api/v1/admin/earnings')) return ['14. Admin Panel & Controls', '14.7 Financial Earnings & Billing Logs'];
    if (p.startsWith('/api/v1/admin/settings')) return ['14. Admin Panel & Controls', '14.8 Feature Toggles & System Settings'];
    return ['14. Admin Panel & Controls', '14.9 Audit Logs & Monitoring'];
  }

  if (p.startsWith('/api/v1/webhooks')) {
    return ['15. Platform Webhooks', '15.1 Webhook Receivers'];
  }

  if (p.startsWith('/api/v1/auth')) {
    return ['01. Authentication & Sessions', '01.1 Customer Auth'];
  }

  if (p.startsWith('/api/v1/users')) {
    return ['02. User Profile & Preferences', '02.1 Profile & Settings'];
  }

  if (p.startsWith('/api/v1/search')) {
    return ['03. Search & Discovery', '03.1 Aggregated Search'];
  }

  if (p.startsWith('/api/v1/image-search')) {
    return ['04. Image Search & AI Detection', '04.1 Visual Similarity Search'];
  }

  if (p.startsWith('/api/v1/brands') || p.startsWith('/api/v1/watch-models') || p.startsWith('/api/v1/marketplaces') || (p.startsWith('/api/v1/listings') && method === 'GET' && !p.includes('/images') && !p.includes('/analytics'))) {
    if (p.includes('/outbound-link') || p.includes('/price-history') || p.includes('/similar') || p.includes('/seller') || p === '/api/v1/listings/{{listingId}}' || p === '/api/v1/listings/:listingId' || p === '/api/v1/listings') {
      return ['05. Watch Details & Catalog', '05.1 Catalog & Product Info'];
    }
    return ['05. Watch Details & Catalog', '05.2 Brands & Model Variants'];
  }

  if (p.startsWith('/api/v1/analytics') || p.startsWith('/api/v1/recommendations') || p.startsWith('/api/v1/portfolio')) {
    return ['06. Price Trend & Market Analytics', '06.1 Market Insights & Trends'];
  }

  if (p.startsWith('/api/v1/saved-searches')) {
    return ['08. Saved Searches & Search Alerts', '08.1 Saved Search Queries'];
  }

  if (p.startsWith('/api/v1/watchlists') || p.endsWith('/save') || p.includes('/save') || p.startsWith('/api/v1/me/saved-listings')) {
    return ['07. Bookmarks & Watchlists', '07.1 Saved Listings & Watchlists'];
  }

  if (p.startsWith('/api/v1/notifications') || p.startsWith('/api/v1/notification-preferences') || p.startsWith('/api/v1/devices')) {
    return ['09. Notifications & Price Drop Alerts', '09.1 Push Notifications & Feeds'];
  }

  if (p.startsWith('/api/v1/orders') || p.startsWith('/api/v1/me/orders') || p.startsWith('/api/v1/sellers') || p.startsWith('/api/v1/reviews')) {
    return ['11. In-App Orders & Transactions', '11.1 Orders & Payments'];
  }

  if (p.startsWith('/api/v1/subscriptions')) {
    return ['12. Subscriptions & Quota (5 Searches/mo Check)', '12.1 Plans & Quota Checks'];
  }

  if (p.startsWith('/api/v1/support') || p.startsWith('/api/v1/reports') || p.startsWith('/api/v1/me/reports') || p.startsWith('/api/v1/content')) {
    return ['13. Support, Content & Reports', '13.1 Help & Static Content'];
  }

  if (p.startsWith('/api/v1/trader-collection') || p.startsWith('/api/v1/traders') || p.startsWith('/api/v1/me/listings') || p.startsWith('/api/v1/me/sales') || p.startsWith('/api/v1/listings')) {
    return ['10. Peer-to-Peer Marketplace & Trader Listings', '10.1 Trader Listings & Management'];
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
