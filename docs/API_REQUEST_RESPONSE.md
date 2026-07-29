# WatchBox API Request And Response Reference

Base URL: `http://localhost:4000`

Use `{{accessToken}}` from login/register responses for protected routes.
Use `{{refreshToken}}` from login/register responses for refresh routes.

### POST /api/v1/auth/login
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/login
Content-Type: application/json
```
Request body:
```json
{
  "email": "customer@example.com",
  "password": "customer-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "64f000000000000000000001",
      "email": "customer@example.com",
      "displayName": "Customer One"
    },
    "sessionId": "64f000000000000000000002",
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/register
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/register
Content-Type: application/json
```
Request body:
```json
{
  "email": "customer@example.com",
  "password": "customer-password",
  "displayName": "Customer One"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "64f000000000000000000001",
      "email": "customer@example.com",
      "displayName": "Customer One"
    },
    "sessionId": "64f000000000000000000002",
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/refresh
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/refresh
Content-Type: application/json
```
Request body:
```json
{
  "refreshToken": "{{refreshToken}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "sessionId": "64f000000000000000000002",
    "tokens": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-jwt-refresh-token",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/logout
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/auth/logout
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "logout",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/logout-all
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/auth/logout-all
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "logout-all",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/verify-email/request
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/verify-email/request
Content-Type: application/json
```
Request body:
```json
{
  "email": "customer@example.com"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "delivery": "email",
    "expiresInMinutes": 1440,
    "developmentToken": "development-only-token"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/verify-email/confirm
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/verify-email/confirm
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/forgot-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/forgot-password
Content-Type: application/json
```
Request body:
```json
{
  "email": "customer@example.com"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "delivery": "email",
    "expiresInMinutes": 15,
    "developmentToken": "development-only-token"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/reset-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/auth/reset-password
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reset-password",
    "status": "active",
    "data": {
      "token": "{{token}}",
      "newPassword": "new-password",
      "confirmPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/auth/change-password
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/auth/change-password
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "currentPassword": "current-password",
  "newPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "change-password",
    "status": "active",
    "data": {
      "currentPassword": "current-password",
      "newPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/auth/sessions
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/auth/sessions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/auth/sessions/:sessionId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/auth/sessions/{{sessionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "sessionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/users/me
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/users/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/users/me
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/users/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "displayName": "Updated Name",
  "phone": "+15551234567",
  "country": "United States"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "me",
    "status": "active",
    "data": {
      "displayName": "Updated Name",
      "phone": "+15551234567",
      "country": "United States"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/users/me
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/users/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "me",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/users/me/activity
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/users/me/activity
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/users/me/stats
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/users/me/stats
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/users/me/preferences
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/users/me/preferences
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/users/me/preferences
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/users/me/preferences
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "preferences",
    "status": "active",
    "data": {
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/users/me/avatar/upload-url
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/users/me/avatar/upload-url
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "upload-url",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/users/me/avatar/confirm
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/users/me/avatar/confirm
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "avatarKey": "{{avatarKey}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "confirm",
    "status": "active",
    "data": {
      "avatarKey": "{{avatarKey}}"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/users/me/avatar
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/users/me/avatar
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "avatar",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/subscriptions/plans
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/subscriptions/plans
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/subscriptions/plans/:planId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/subscriptions/plans/{{planId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "planId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/subscriptions/me
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/subscriptions/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/subscriptions/me/usage
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/subscriptions/me/usage
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/subscriptions/invoices
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/subscriptions/invoices
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/subscriptions/checkout-session
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/subscriptions/checkout-session
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "checkout-session",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/subscriptions/portal-session
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/subscriptions/portal-session
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "portal-session",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/subscriptions/change-plan
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/subscriptions/change-plan
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "planId": "{{planId}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "change-plan",
    "status": "active",
    "data": {
      "planId": "{{planId}}"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/subscriptions/cancel
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/subscriptions/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "cancel",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/subscriptions/resume
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/subscriptions/resume
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "resume",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/brands
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/brands
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/brands/:slug
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/brands/{{slug}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "slug",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/brands/:slug/models
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/brands/{{slug}}/models
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "models",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models/:watchModelId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models/{{watchModelId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchModelId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models/:watchModelId/variants
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models/{{watchModelId}}/variants
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "variants",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models/:watchModelId/listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models/{{watchModelId}}/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listings",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models/:watchModelId/similar
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models/{{watchModelId}}/similar
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "similar",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watch-models/:watchModelId/market-summary
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watch-models/{{watchModelId}}/market-summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "market-summary",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listingId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listings",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/listings/:listingId
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/listings/{{listingId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listingId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/listings/:listingId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/listings/{{listingId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listingId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/submit
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/submit
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "submit",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/publish
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/publish
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "publish",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/pause
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/pause
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "pause",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/resume
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/resume
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "resume",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/archive
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/archive
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "archive",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/mark-sold
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/mark-sold
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "mark-sold",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/reserve
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/reserve
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reserve",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/unreserve
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/unreserve
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "unreserve",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId/price-history
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}/price-history
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "price-history",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId/status-history
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}/status-history
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "status-history",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId/similar
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}/similar
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "similar",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId/seller
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}/seller
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "seller",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/contact-seller
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/contact-seller
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "contact-seller",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/report
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/report
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "report",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/view
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/view
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "view",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/images/upload-urls
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/images/upload-urls
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "upload-urls",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/images/confirm
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/images/confirm
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "confirm",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/listings/:listingId/images/order
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/listings/{{listingId}}/images/order
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "order",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/listings/:listingId/images/:imageId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/listings/{{listingId}}/images/{{imageId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "imageId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/images/:imageId/reprocess
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/images/{{imageId}}/reprocess
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reprocess",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/auto-detect
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/auto-detect
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "auto-detect",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/drafts
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/drafts
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/pending
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/pending
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/active
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/active
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/paused
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/paused
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/rejected
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/rejected
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/sold
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/sold
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/archived
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/archived
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/listings/:listingId/analytics
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/listings/{{listingId}}/analytics
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "analytics",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/sales
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/sales
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/sales/summary
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/sales/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/sales/export
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/sales/export
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/trader-collection
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/trader-collection
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/trader-collection/featured
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/trader-collection/featured
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/trader-collection/traders
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/trader-collection/traders
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/traders/:traderId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/traders/{{traderId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "traderId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/traders/:traderId/listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/traders/{{traderId}}/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listings",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/marketplaces
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/marketplaces
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/listings/:listingId/outbound-link
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/listings/{{listingId}}/outbound-link
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "outbound-link",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/search
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/search
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/search/suggestions
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/search/suggestions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/search/popular
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/search/popular
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/search/recent
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/search/recent
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/search/recent
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/search/recent
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "recent",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/search/facets
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/search/facets
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/search/preview-count
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/search/preview-count
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "preview-count",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/image-search/upload-url
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/image-search/upload-url
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "upload-url",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/image-search
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/image-search
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "image-search",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/image-search/recent
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/image-search/recent
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/image-search/:searchId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/image-search/{{searchId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "searchId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/image-search/:searchId/results
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/image-search/{{searchId}}/results
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "results",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/image-search/:searchId/feedback
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/image-search/{{searchId}}/feedback
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "feedback",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/image-search/:searchId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/image-search/{{searchId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "searchId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/image-search/recent
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/image-search/recent
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "recent",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/saved-searches
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/saved-searches
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/saved-searches
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/saved-searches
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "saved-searches",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/saved-searches/:savedSearchId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "savedSearchId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/saved-searches/:savedSearchId
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "savedSearchId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/saved-searches/:savedSearchId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "savedSearchId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/saved-searches/:savedSearchId/run
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}/run
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "run",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/saved-searches/:savedSearchId/alerts/enable
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}/alerts/enable
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "enable",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/saved-searches/:savedSearchId/alerts/disable
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}/alerts/disable
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "disable",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/saved-searches/:savedSearchId/matches
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/saved-searches/{{savedSearchId}}/matches
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "matches",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watchlists
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watchlists
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/watchlists
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/watchlists
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchlists",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watchlists/:watchlistId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watchlists/{{watchlistId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchlistId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/watchlists/:watchlistId
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/watchlists/{{watchlistId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchlistId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/watchlists/:watchlistId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/watchlists/{{watchlistId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchlistId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/watchlists/:watchlistId/items
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/watchlists/{{watchlistId}}/items
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "items",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/watchlists/:watchlistId/items
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/watchlists/{{watchlistId}}/items
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "items",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/watchlists/:watchlistId/items/:listingId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/watchlists/{{watchlistId}}/items/{{listingId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listingId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/saved-listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/saved-listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/listings/:listingId/save
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/listings/{{listingId}}/save
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "title": "Rolex Submariner Date",
  "brand": "Rolex",
  "model": "Submariner",
  "price": 12500,
  "currency": "USD",
  "condition": "excellent"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "save",
    "status": "active",
    "data": {
      "title": "Rolex Submariner Date",
      "brand": "Rolex",
      "model": "Submariner",
      "price": 12500,
      "currency": "USD",
      "condition": "excellent"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/listings/:listingId/save
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/listings/{{listingId}}/save
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "save",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/notifications
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/notifications
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/notifications/unread-count
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/notifications/unread-count
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/notifications/:notificationId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/notifications/{{notificationId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "notificationId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/notifications/:notificationId/read
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/notifications/{{notificationId}}/read
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "read",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/notifications/read-all
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/notifications/read-all
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "read-all",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/notifications/:notificationId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/notifications/{{notificationId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "notificationId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/notifications
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/notifications
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "notifications",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/notifications/stream
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/notifications/stream
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/notification-preferences
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/notification-preferences
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/notification-preferences
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/notification-preferences
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "notification-preferences",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/devices
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/devices
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "devices",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/devices/:deviceId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/devices/{{deviceId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "deviceId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/home
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/home
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/for-you
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/for-you
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/based-on-saved
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/based-on-saved
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/based-on-listings
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/based-on-listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/trending
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/trending
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/recommendations/market-opportunities
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/recommendations/market-opportunities
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/recommendations/:listingId/impression
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/recommendations/{{listingId}}/impression
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "impression",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/recommendations/:listingId/click
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/recommendations/{{listingId}}/click
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "click",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/recommendations/:listingId/hide
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/recommendations/{{listingId}}/hide
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "hide",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/recommendations/:listingId/feedback
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/recommendations/{{listingId}}/feedback
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "feedback",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/market-overview
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/market-overview
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/market-insights
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/market-insights
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/trending
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/trending
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/biggest-drops
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/biggest-drops
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/biggest-gains
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/biggest-gains
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/most-searched
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/most-searched
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "watchModelId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId/price-trend
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}/price-trend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "price-trend",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId/liquidity
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}/liquidity
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "liquidity",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId/volume
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}/volume
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "volume",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId/volatility
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}/volatility
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "volatility",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/watch-models/:watchModelId/marketplaces
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/watch-models/{{watchModelId}}/marketplaces
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "marketplaces",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/listings/:listingId/value-comparison
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/listings/{{listingId}}/value-comparison
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "value-comparison",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/portfolio
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/portfolio
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/analytics/portfolio/history
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/analytics/portfolio/history
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/portfolio
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/portfolio
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/portfolio/summary
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/portfolio/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/portfolio
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/portfolio
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "portfolio",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/portfolio/:portfolioItemId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/portfolio/{{portfolioItemId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "portfolioItemId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/portfolio/:portfolioItemId
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/portfolio/{{portfolioItemId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "portfolioItemId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/portfolio/:portfolioItemId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/portfolio/{{portfolioItemId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "portfolioItemId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/portfolio/:portfolioItemId/value-history
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/portfolio/{{portfolioItemId}}/value-history
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "value-history",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/portfolio/:portfolioItemId/link-listing
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/portfolio/{{portfolioItemId}}/link-listing
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "link-listing",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "orders",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/orders/:orderId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/orders/{{orderId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "orderId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/orders
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/orders
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/payment-intent
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/payment-intent
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "payment-intent",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/cancel
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "cancel",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/confirm-shipment
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/confirm-shipment
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "confirm-shipment",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/confirm-delivery
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/confirm-delivery
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "confirm-delivery",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/dispute
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/dispute
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "dispute",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/orders/:orderId/reviews
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/orders/{{orderId}}/reviews
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "listingId": "{{listingId}}",
  "offerAmount": 12000,
  "currency": "USD"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reviews",
    "status": "active",
    "data": {
      "listingId": "{{listingId}}",
      "offerAmount": 12000,
      "currency": "USD"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/sellers/:sellerId/reviews
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/sellers/{{sellerId}}/reviews
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reviews",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/reviews/:reviewId
Auth: Bearer token required (Customer)
Request:
```http
PATCH {{baseUrl}}/api/v1/reviews/{{reviewId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reviewId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/reviews/:reviewId
Auth: Bearer token required (Customer)
Request:
```http
DELETE {{baseUrl}}/api/v1/reviews/{{reviewId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reviewId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/reports/listing
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/reports/listing
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listing",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/reports/user
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/reports/user
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "user",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/reports
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/reports
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/me/reports/:reportId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/me/reports/{{reportId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reportId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/support/tickets
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/support/tickets
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "subject": "Need help",
  "message": "Please help with my order."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "tickets",
    "status": "active",
    "data": {
      "subject": "Need help",
      "message": "Please help with my order."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/support/tickets
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/support/tickets
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/support/tickets/:ticketId
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/support/tickets/{{ticketId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "ticketId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/support/tickets/:ticketId/messages
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/support/tickets/{{ticketId}}/messages
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "subject": "Need help",
  "message": "Please help with my order."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "messages",
    "status": "active",
    "data": {
      "subject": "Need help",
      "message": "Please help with my order."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/support/tickets/:ticketId/close
Auth: Bearer token required (Customer)
Request:
```http
POST {{baseUrl}}/api/v1/support/tickets/{{ticketId}}/close
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "subject": "Need help",
  "message": "Please help with my order."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "close",
    "status": "active",
    "data": {
      "subject": "Need help",
      "message": "Please help with my order."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/content/terms
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/content/terms
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/content/privacy-policy
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/content/privacy-policy
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/content/about
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/content/about
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/content/support
Auth: Bearer token required (Customer)
Request:
```http
GET {{baseUrl}}/api/v1/content/support
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/login
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/login
Content-Type: application/json
```
Request body:
```json
{
  "email": "admin@example.com",
  "password": "admin-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "64f000000000000000000001",
      "email": "admin@example.com",
      "displayName": "Admin One"
    },
    "sessionId": "64f000000000000000000002",
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/refresh
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/refresh
Content-Type: application/json
```
Request body:
```json
{
  "refreshToken": "{{refreshToken}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "sessionId": "64f000000000000000000002",
    "tokens": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-jwt-refresh-token",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/logout
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/logout
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "logout",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/logout-all
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/logout-all
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "logout-all",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/forgot-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/forgot-password
Content-Type: application/json
```
Request body:
```json
{
  "email": "customer@example.com"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "delivery": "email",
    "expiresInMinutes": 15,
    "developmentToken": "development-only-token"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/verify-reset-code
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/verify-reset-code
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "verify-reset-code",
    "status": "active",
    "data": {
      "token": "{{token}}"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/reset-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/reset-password
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reset-password",
    "status": "active",
    "data": {
      "token": "{{token}}",
      "newPassword": "new-password",
      "confirmPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/change-password
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/change-password
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "currentPassword": "current-password",
  "newPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "change-password",
    "status": "active",
    "data": {
      "currentPassword": "current-password",
      "newPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/auth/sessions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/auth/sessions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/auth/sessions/:sessionId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/auth/sessions/{{sessionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "sessionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/mfa/setup
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/mfa/setup
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "setup",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/mfa/verify
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/mfa/verify
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "code": "{{mfaCode}}"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "verify",
    "status": "active",
    "data": {
      "code": "{{mfaCode}}"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/auth/mfa/challenge
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/auth/mfa/challenge
Content-Type: application/json
```
Request body:
```json
{
  "email": "admin@example.com"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "challenge",
    "status": "active",
    "data": {
      "email": "admin@example.com"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/auth/mfa
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/auth/mfa
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "mfa",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/auth/me/permissions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/auth/me/permissions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/summary
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/user-growth
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/user-growth
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/revenue-trend
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/revenue-trend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/watch-search-trends
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/watch-search-trends
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/active-users
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/active-users
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/marketplace-status
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/marketplace-status
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/recent-activity
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/recent-activity
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/dashboard/pending-actions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/dashboard/pending-actions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/summary
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/export
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/export
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/bulk-actions
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/bulk-actions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "bulk-actions",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "userId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/activity
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/activity
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "activity",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/listings
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "listings",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/orders
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/orders
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "orders",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/subscriptions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/subscriptions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "subscriptions",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/payments
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/payments
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "payments",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/users/:userId/reports
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/users/{{userId}}/reports
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reports",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/users/:userId/profile
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/users/{{userId}}/profile
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "profile",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/users/:userId/status
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/users/{{userId}}/status
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "status",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/suspend
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/suspend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "suspend",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/unsuspend
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/unsuspend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "unsuspend",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/verify-email
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/verify-email
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "verify-email",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/reset-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/reset-password
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reset-password",
    "status": "active",
    "data": {
      "token": "{{token}}",
      "newPassword": "new-password",
      "confirmPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/revoke-sessions
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/revoke-sessions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "revoke-sessions",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/users/:userId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/users/{{userId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "userId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/users/:userId/restore
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/users/{{userId}}/restore
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "restore",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/administrators
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/administrators
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "administrators",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/administrators/roles
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/administrators/roles
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators/roles
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators/roles
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "roles",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/administrators/permissions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/administrators/permissions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/administrators/:adminId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/administrators/{{adminId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "adminId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/administrators/:adminId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/administrators/{{adminId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "adminId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/administrators/:adminId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/administrators/{{adminId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "adminId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators/:adminId/activate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/activate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "activate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators/:adminId/suspend
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/suspend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "suspend",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators/:adminId/reset-password
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/reset-password
Content-Type: application/json
```
Request body:
```json
{
  "token": "{{token}}",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reset-password",
    "status": "active",
    "data": {
      "token": "{{token}}",
      "newPassword": "new-password",
      "confirmPassword": "new-password"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/administrators/:adminId/revoke-sessions
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/revoke-sessions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "revoke-sessions",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/administrators/:adminId/roles
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/roles
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "roles",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/administrators/:adminId/permissions
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/permissions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "permissions",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/administrators/:adminId/activity
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/administrators/{{adminId}}/activity
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "activity",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/plans
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/plans
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/plans
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/plans
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "plans",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/plans/:planId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "planId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/subscriptions/plans/:planId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "planId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/subscriptions/plans/:planId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "planId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/plans/:planId/activate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}/activate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "activate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/plans/:planId/deactivate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}/deactivate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "deactivate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/plans/:planId/duplicate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}/duplicate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "duplicate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/subscriptions/plans/:planId/features
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/subscriptions/plans/{{planId}}/features
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "features",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/customers
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/customers
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/customers/:subscriptionId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "subscriptionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/customers/:subscriptionId/cancel
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "cancel",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/customers/:subscriptionId/resume
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}/resume
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "resume",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/customers/:subscriptionId/change-plan
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}/change-plan
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "change-plan",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/customers/:subscriptionId/extend
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}/extend
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "extend",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/customers/:subscriptionId/refund
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/customers/{{subscriptionId}}/refund
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "refund",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/assign
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/assign
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "assign",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/promotions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/promotions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/promotions
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/promotions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "promotions",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/subscriptions/promotions/:promotionId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/subscriptions/promotions/{{promotionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "promotionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/subscriptions/promotions/:promotionId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/subscriptions/promotions/{{promotionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "promotionId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/subscriptions/promotions/:promotionId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/subscriptions/promotions/{{promotionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "promotionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/promotions/:promotionId/activate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/promotions/{{promotionId}}/activate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "activate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/subscriptions/promotions/:promotionId/deactivate
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/subscriptions/promotions/{{promotionId}}/deactivate
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "deactivate",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/summary
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/transactions
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/transactions
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/transactions/export
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/transactions/export
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/transactions/:transactionId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/transactions/{{transactionId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "transactionId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/refunds
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/refunds
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/earnings/refunds/:paymentId
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/earnings/refunds/{{paymentId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "paymentId",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/subscription-revenue
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/subscription-revenue
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/earnings/marketplace-fees
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/earnings/marketplace-fees
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "marketplaces",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces/:marketplaceId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "marketplaceId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/marketplaces/:marketplaceId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "marketplaceId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/marketplaces/:marketplaceId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "marketplaceId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/enable
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/enable
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "enable",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/disable
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/disable
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "disable",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/test-connection
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/test-connection
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "test-connection",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/sync
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/sync
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "sync",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces/:marketplaceId/sync-status
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/sync-status
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "sync-status",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces/:marketplaceId/sync-runs
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/sync-runs
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "sync-runs",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces/:marketplaceId/errors
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/errors
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "errors",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/errors/:errorId/retry
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/errors/{{errorId}}/retry
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "retry",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/marketplaces/:marketplaceId/credentials
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/credentials
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "credentials",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/marketplaces/:marketplaceId/credentials
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/credentials
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "credentials",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/marketplaces/:marketplaceId/credentials/:credentialId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/credentials/{{credentialId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "credentialId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/marketplaces/:marketplaceId/credentials/:credentialId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/marketplaces/{{marketplaceId}}/credentials/{{credentialId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "credentialId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/campaigns
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/campaigns
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaigns",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns/:campaignId/publish
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/publish
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "publish",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns/:campaignId/pause
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/pause
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "pause",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns/:campaignId/resume
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/resume
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "resume",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns/:campaignId/cancel
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "cancel",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/campaigns/:campaignId/analytics
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/analytics
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "analytics",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/campaigns/:campaignId/posts
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/posts
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "posts",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/campaigns/:campaignId/posts
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/campaigns/{{campaignId}}/posts
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "posts",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/bulk-email/campaigns
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/bulk-email/campaigns
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaigns",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/bulk-email/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/bulk-email/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/bulk-email/campaigns/:campaignId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "campaignId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns/:campaignId/preview
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/preview
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "preview",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns/:campaignId/test
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/test
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "test",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns/:campaignId/send
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/send
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "send",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns/:campaignId/schedule
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/schedule
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "schedule",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/campaigns/:campaignId/cancel
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "cancel",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/bulk-email/campaigns/:campaignId/analytics
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/bulk-email/campaigns/{{campaignId}}/analytics
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "analytics",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/bulk-email/templates
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/bulk-email/templates
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/bulk-email/templates
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/bulk-email/templates
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "templates",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/bulk-email/templates/:templateId
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/bulk-email/templates/{{templateId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "templateId",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### DELETE /api/v1/admin/bulk-email/templates/:templateId
Auth: Bearer token required (Admin)
Request:
```http
DELETE {{baseUrl}}/api/v1/admin/bulk-email/templates/{{templateId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "templateId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/reports
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/reports
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/reports/summary
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/reports/summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/reports/export
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/reports/export
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/reports/:reportId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/reports/{{reportId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "reportId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/reports/:reportId/assign
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/reports/{{reportId}}/assign
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "assign",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/reports/:reportId/status
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/reports/{{reportId}}/status
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "status",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/reports/:reportId/resolve
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/reports/{{reportId}}/resolve
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "resolve",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/reports/:reportId/dismiss
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/reports/{{reportId}}/dismiss
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "dismiss",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/reports/:reportId/comments
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/reports/{{reportId}}/comments
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "reason": "suspicious",
  "message": "Please review this item."
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "comments",
    "status": "active",
    "data": {
      "reason": "suspicious",
      "message": "Please review this item."
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/reports/:reportId/comments
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/reports/{{reportId}}/comments
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "comments",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/settings/general
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/settings/general
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/settings/general
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/settings/general
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "general",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/settings/features
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/settings/features
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/settings/features/:featureKey
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/settings/features/{{featureKey}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "featureKey",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/settings/security
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/settings/security
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/settings/security
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/settings/security
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "security",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/settings/content/pages
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/settings/content/pages
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/settings/content/pages/:slug
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/settings/content/pages/{{slug}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "slug",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### PATCH /api/v1/admin/settings/content/pages/:slug
Auth: Bearer token required (Admin)
Request:
```http
PATCH {{baseUrl}}/api/v1/admin/settings/content/pages/{{slug}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Updated value",
  "status": "active"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "slug",
    "status": "active",
    "data": {
      "name": "Updated value",
      "status": "active"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/admin/settings/content/pages/:slug/publish
Auth: Bearer token required (Admin)
Request:
```http
POST {{baseUrl}}/api/v1/admin/settings/content/pages/{{slug}}/publish
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
{
  "name": "Example",
  "description": "Example request body"
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "publish",
    "status": "active",
    "data": {
      "name": "Example",
      "description": "Example request body"
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/audit-logs
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/audit-logs
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/audit-logs/export
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/audit-logs/export
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1,
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### GET /api/v1/admin/audit-logs/:auditLogId
Auth: Bearer token required (Admin)
Request:
```http
GET {{baseUrl}}/api/v1/admin/audit-logs/{{auditLogId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```
Request body:
```json
null
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "auditLogId",
    "status": "active",
    "data": {}
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/webhooks/stripe
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/webhooks/stripe
x-watchbox-signature: {{webhookSignature}}
Content-Type: application/json
```
Request body:
```json
{
  "id": "evt_123",
  "type": "event.received",
  "data": {
    "example": true
  }
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "stripe",
    "status": "active",
    "data": {
      "id": "evt_123",
      "type": "event.received",
      "data": {
        "example": true
      }
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/webhooks/ebay
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/webhooks/ebay
x-watchbox-signature: {{webhookSignature}}
Content-Type: application/json
```
Request body:
```json
{
  "id": "evt_123",
  "type": "event.received",
  "data": {
    "example": true
  }
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "ebay",
    "status": "active",
    "data": {
      "id": "evt_123",
      "type": "event.received",
      "data": {
        "example": true
      }
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/webhooks/email
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/webhooks/email
x-watchbox-signature: {{webhookSignature}}
Content-Type: application/json
```
Request body:
```json
{
  "id": "evt_123",
  "type": "event.received",
  "data": {
    "example": true
  }
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "email",
    "status": "active",
    "data": {
      "id": "evt_123",
      "type": "event.received",
      "data": {
        "example": true
      }
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
### POST /api/v1/webhooks/push
Auth: No auth
Request:
```http
POST {{baseUrl}}/api/v1/webhooks/push
x-watchbox-signature: {{webhookSignature}}
Content-Type: application/json
```
Request body:
```json
{
  "id": "evt_123",
  "type": "event.received",
  "data": {
    "example": true
  }
}
```
Success response:
```json
{
  "success": true,
  "data": {
    "id": "64f000000000000000000001",
    "resource": "push",
    "status": "active",
    "data": {
      "id": "evt_123",
      "type": "event.received",
      "data": {
        "example": true
      }
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```
Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "field",
        "message": "Required"
      }
    ]
  },
  "meta": {
    "requestId": "request-id"
  }
}
```