# useLoginRedirect Hook Documentation

A custom React hook for handling authentication redirects with return URL support.

## Features

- ✅ Redirects unauthenticated users to login with `returnTo` parameter
- ✅ Returns users to their intended destination after successful login
- ✅ Prevents open redirect vulnerabilities
- ✅ Clean API with TypeScript support

---

## Installation

The hook is located at: `/src/lib/hooks/useLoginRedirect.ts`

---

## API

### `useLoginRedirect()`

Returns an object with three functions:

```typescript
const { redirectToLogin, getReturnUrl, handleSuccessfulLogin } = useLoginRedirect();
```

#### `redirectToLogin(customReturnTo?: string): void`

Redirects to login page with current path as `returnTo` parameter.

**Parameters:**
- `customReturnTo` (optional): Custom return path. If not provided, uses current pathname.

**Example:**
```typescript
// Redirect to login with current page as returnTo
redirectToLogin();

// Redirect to login with custom returnTo
redirectToLogin('/dashboard/tenure');
```

**Security:**
- Automatically excludes `/login` and `/register` pages from returnTo
- Prevents redirect loops

---

#### `getReturnUrl(defaultPath?: string): string`

Gets the return URL from search params, or returns default.

**Parameters:**
- `defaultPath` (optional): Default path if no `returnTo` is specified. Defaults to `/dashboard`.

**Returns:**
- Safe, validated internal path

**Example:**
```typescript
const returnUrl = getReturnUrl(); // Returns '/dashboard' by default
const customUrl = getReturnUrl('/profile'); // Returns '/profile' if no returnTo
```

**Security:**
- Validates that returnTo is a safe internal path
- Prevents open redirect attacks
- Only allows relative paths starting with `/`

---

#### `handleSuccessfulLogin(): void`

Handles successful login by redirecting to `returnTo` URL or dashboard.

**Example:**
```typescript
// After setting user in store
setUser(userData);
handleSuccessfulLogin(); // Redirects to returnTo or /dashboard
```

---

## Usage Examples

### 1. In Login Page (Already Implemented)

```typescript
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

export default function LoginPage() {
    const { handleSuccessfulLogin, getReturnUrl } = useLoginRedirect();
    
    // Check if already logged in
    useEffect(() => {
        if (user) {
            const returnUrl = getReturnUrl();
            router.replace(returnUrl);
        }
    }, [user, getReturnUrl]);
    
    // After successful login
    const handleSubmit = async (formData) => {
        const res = await loginAction(formData);
        if (res.success) {
            setUser(res.data);
            handleSuccessfulLogin(); // Redirects to returnTo or /dashboard
        }
    };
}
```

---

### 2. In Store Initializer (Already Implemented)

```typescript
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

export function StoreInitializer() {
    const { redirectToLogin } = useLoginRedirect();
    
    useEffect(() => {
        if (!user) {
            redirectToLogin(); // Redirects with current path as returnTo
        }
    }, [user, redirectToLogin]);
}
```

---

### 3. In Protected Component

```typescript
"use client";

import { useEffect } from "react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

export function ProtectedContent() {
    const user = useProfileStore((state) => state.user);
    const { redirectToLogin } = useLoginRedirect();
    
    useEffect(() => {
        if (!user) {
            // Will redirect to login with returnTo=/current-page
            redirectToLogin();
        }
    }, [user, redirectToLogin]);
    
    if (!user) {
        return <div>Loading...</div>;
    }
    
    return <div>Protected content</div>;
}
```

---

### 4. Manual Redirect with Custom Path

```typescript
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

export function SomeComponent() {
    const { redirectToLogin } = useLoginRedirect();
    
    const handleProtectedAction = () => {
        // Redirect to login, but return to a specific page after login
        redirectToLogin('/dashboard/tenure');
    };
}
```

---

## URL Format

### Login URL with returnTo:
```
/login?returnTo=%2Fdashboard%2Ftenure
```

### Decoded:
```
/login?returnTo=/dashboard/tenure
```

After successful login, user is redirected to: `/dashboard/tenure`

---

## Security Features

### 1. **Prevents Open Redirect**
Only allows relative paths starting with `/`:
```typescript
// ✅ Allowed
/dashboard
/dashboard/tenure
/profile

// ❌ Blocked (redirects to /dashboard instead)
//example.com/phishing
https://evil.com
```

### 2. **Prevents Redirect Loops**
Automatically excludes auth pages:
```typescript
// Current path: /login
redirectToLogin(); // Does NOT add returnTo=/login

// Current path: /register  
redirectToLogin(); // Does NOT add returnTo=/register
```

### 3. **URL Encoding**
Properly encodes/decodes URLs:
```typescript
// Input: /dashboard/tenure
// URL: /login?returnTo=%2Fdashboard%2Ftenure
// Decoded: /dashboard/tenure
```

---

## Flow Diagram

```
User visits protected page (/dashboard/tenure)
  ↓
Not authenticated
  ↓
redirectToLogin() called
  ↓
Redirect to: /login?returnTo=%2Fdashboard%2Ftenure
  ↓
User logs in successfully
  ↓
handleSuccessfulLogin() called
  ↓
getReturnUrl() extracts: /dashboard/tenure
  ↓
Redirect to: /dashboard/tenure
  ✓ User is back where they wanted to go!
```

---

## Testing

### Test Case 1: Normal Login
1. Visit `/login` directly
2. Login successfully
3. Should redirect to `/dashboard` (default)

### Test Case 2: Protected Page Access
1. Visit `/dashboard/tenure` while logged out
2. Redirected to `/login?returnTo=%2Fdashboard%2Ftenure`
3. Login successfully
4. Should redirect to `/dashboard/tenure`

### Test Case 3: Already Logged In
1. Already logged in
2. Visit `/login?returnTo=/profile`
3. Should immediately redirect to `/profile`

### Test Case 4: Security - Open Redirect
1. Visit `/login?returnTo=https://evil.com`
2. Login successfully
3. Should redirect to `/dashboard` (ignores malicious URL)

---

## Notes

- ✅ Works with Next.js App Router
- ✅ Uses `useSearchParams`, `usePathname`, `useRouter` hooks
- ✅ TypeScript support
- ✅ Client-side only (uses 'use client' directive)
- ✅ No external dependencies

---

## Future Enhancements

Potential improvements:
- [ ] Add support for query params preservation
- [ ] Add support for hash fragments
- [ ] Add analytics tracking for redirect flows
- [ ] Add timeout for stale returnTo URLs
- [ ] Add support for post-login callbacks

---

**Last Updated**: January 16, 2026
