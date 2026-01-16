# Login Redirect with ReturnTo - Implementation Summary

## 🎯 What Was Implemented

A complete login redirect system using a custom React hook that preserves the user's intended destination when they're redirected to login.

---

## 📁 Files Created/Modified

### Created:
1. **`/src/lib/hooks/useLoginRedirect.ts`** - Main hook implementation
2. **`/src/lib/hooks/useLoginRedirect.md`** - Comprehensive documentation
3. **`/src/lib/hooks/useLoginRedirect.example.tsx`** - Usage examples

### Modified:
1. **`/src/app/(auth)/login/page.tsx`** - Uses hook for login redirects
2. **`/src/components/dashboard/store-initializer.tsx`** - Uses hook for auth checks

---

## 🔧 How It Works

### Flow Diagram

```
User visits protected page
  ↓
/dashboard/tenure
  ↓
Not authenticated
  ↓
StoreInitializer detects no user
  ↓
redirectToLogin() called
  ↓
Redirect to: /login?returnTo=/dashboard/tenure
  ↓
User enters credentials
  ↓
Login successful
  ↓
handleSuccessfulLogin() called
  ↓
Extracts returnTo from URL
  ↓
Redirect to: /dashboard/tenure
  ✅
User is back where they wanted to be!
```

---

## 🎨 Hook API

```typescript
const { redirectToLogin, getReturnUrl, handleSuccessfulLogin } = useLoginRedirect();
```

### Methods:

1. **`redirectToLogin(customReturnTo?: string)`**
   - Redirects to login with current/custom path as returnTo
   - Example: `redirectToLogin()` or `redirectToLogin('/dashboard/profile')`

2. **`getReturnUrl(defaultPath?: string)`**
   - Gets returnTo from URL params, validates it, returns safe path
   - Example: `getReturnUrl()` returns `/dashboard` by default

3. **`handleSuccessfulLogin()`**
   - Redirects to returnTo URL after successful login
   - Example: Call after `setUser(userData)`

---

## 💻 Usage Examples

### In Login Page:
```typescript
const { handleSuccessfulLogin, getReturnUrl } = useLoginRedirect();

// Check if already logged in
useEffect(() => {
    if (user) {
        const returnUrl = getReturnUrl();
        router.replace(returnUrl);
    }
}, [user]);

// After successful login
async function handleSubmit(formData) {
    const res = await loginAction(formData);
    if (res.success) {
        setUser(res.data);
        handleSuccessfulLogin(); // Redirects to returnTo or /dashboard
    }
}
```

### In Store Initializer:
```typescript
const { redirectToLogin } = useLoginRedirect();

useEffect(() => {
    if (!user) {
        redirectToLogin(); // Redirects with current path as returnTo
    }
}, [user]);
```

### In Protected Component:
```typescript
const { redirectToLogin } = useLoginRedirect();

useEffect(() => {
    if (!user) {
        redirectToLogin(); // Will redirect to login?returnTo=/current-page
    }
}, [user]);
```

---

## 🔐 Security Features

### 1. Prevents Open Redirect
Only allows relative paths starting with `/`:
```typescript
✅ /dashboard              → Allowed
✅ /dashboard/tenure       → Allowed
❌ https://evil.com        → Blocked, redirects to /dashboard
❌ //attacker.com          → Blocked, redirects to /dashboard
```

### 2. Prevents Redirect Loops
Excludes auth pages from returnTo:
```typescript
Current: /login    → redirectToLogin() → /login (no returnTo)
Current: /register → redirectToLogin() → /login (no returnTo)
```

### 3. URL Encoding
Properly encodes/decodes:
```typescript
Input:  /dashboard/tenure
URL:    /login?returnTo=%2Fdashboard%2Ftenure
Output: /dashboard/tenure
```

---

## 🧪 Testing Scenarios

### Test 1: Direct Login
1. Visit `/login` directly
2. Login successfully
3. ✅ Redirects to `/dashboard`

### Test 2: Protected Page Access
1. Logged out, visit `/dashboard/tenure`
2. ✅ Redirects to `/login?returnTo=%2Fdashboard%2Ftenure`
3. Login successfully
4. ✅ Redirects to `/dashboard/tenure`

### Test 3: Already Logged In
1. Already authenticated
2. Visit `/login?returnTo=/profile`
3. ✅ Immediately redirects to `/profile`

### Test 4: Security - Open Redirect
1. Visit `/login?returnTo=https://evil.com`
2. Login successfully
3. ✅ Redirects to `/dashboard` (ignores malicious URL)

### Test 5: Security - Redirect Loop
1. Visit `/login` while logged out
2. ✅ Stays at `/login` (no returnTo parameter)
3. Login successfully
4. ✅ Redirects to `/dashboard`

---

## 📝 Key Implementation Details

### URL Format:
```
/login?returnTo=%2Fdashboard%2Ftenure
```

Decoded: `/login?returnTo=/dashboard/tenure`

### Default Behavior:
- If no `returnTo` parameter → redirects to `/dashboard`
- If `returnTo` is present and valid → redirects to that path
- If `returnTo` is invalid/malicious → redirects to `/dashboard`

### Validation Logic:
```typescript
// Only allow relative paths starting with /
if (decodedPath.startsWith('/') && !decodedPath.startsWith('//')) {
    return decodedPath; // Safe
}
return defaultPath; // Unsafe, use default
```

---

## 🚀 Benefits

1. **Better UX** - Users return to their intended destination
2. **Secure** - Prevents open redirect vulnerabilities
3. **Clean** - Single hook handles all redirect logic
4. **Reusable** - Use anywhere in the app
5. **Type-safe** - Full TypeScript support
6. **Documented** - Comprehensive documentation included

---

## 📚 Documentation

- **Full Docs**: See `/src/lib/hooks/useLoginRedirect.md`
- **Examples**: See `/src/lib/hooks/useLoginRedirect.example.tsx`
- **This Summary**: Quick overview and testing guide

---

## 🔄 Integration Points

### Currently Integrated:
- ✅ Login page (`/app/(auth)/login/page.tsx`)
- ✅ Store initializer (`/components/dashboard/store-initializer.tsx`)

### Can Be Used In:
- Any protected component
- Any layout that requires auth
- Any action that needs auth before proceeding
- Any custom redirect scenario

---

## ⚡ Quick Start

To protect a new page:

```typescript
"use client";

import { useEffect } from "react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

export default function MyProtectedPage() {
    const user = useProfileStore((state) => state.user);
    const { redirectToLogin } = useLoginRedirect();

    useEffect(() => {
        if (!user) redirectToLogin();
    }, [user, redirectToLogin]);

    if (!user) return <div>Loading...</div>;

    return <div>Protected content here!</div>;
}
```

---

**Result**: Users are now redirected back to where they wanted to go after logging in! 🎉

**Last Updated**: January 16, 2026
