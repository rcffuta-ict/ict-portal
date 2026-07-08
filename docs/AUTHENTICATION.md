# 🔐 RCF FUTA E-Library Authentication Architecture

**Complete Documentation for Implementing `@rcffuta/ict-lib` Authentication in Next.js Apps**

---

## 📋 **Architecture Overview**

The RCF FUTA E-Library uses a sophisticated authentication system that combines:

- **@rcffuta/ict-lib** for user management and institutional profiles
- **Supabase Auth** for session management
- **Next.js App Router** for server-side authentication
- **Zustand** for client-side state management
- **HTTP-only cookies** for secure session persistence

---

## 🏗️ **Core Components**

### 1. **ICT Library Client Setup** (`src/lib/ict.ts`)

```typescript
import { RcfIctClient } from '@rcffuta/ict-lib/server'

// Standard client for regular operations
export const ict = RcfIctClient.fromEnv()

// Admin client for elevated operations (bypasses RLS)
export const ictAdmin = RcfIctClient.asAdmin();

// Helper to get current user context
export async function getCurrentUser() {
  try {
    const { data: { session } } = await ict.supabase.auth.getSession()
    if (!session) return null

    const profile = await ict.member.getFullProfile(session.user.id)
    return profile
  } catch (error) {
    console.error('Error fetching user context:', error)
    return null
  }
}
```

**Key Points:**

- `RcfIctClient.fromEnv()` reads from environment variables
- `RcfIctClient.asAdmin()` uses service role for elevated permissions
- Always handle errors gracefully in user context functions

---

### 2. **Authentication Types** (`src/types/app.type.ts`)

```typescript
import { FullUserProfile } from "@rcffuta/ict-lib"

export interface AuthUser {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  user: FullUserProfile // ICT lib profile with academics, personal info, etc.
}
```

**Key Points:**

- Extends `FullUserProfile` from ict-lib for institutional data
- Includes role-based access control
- Maintains compatibility with Supabase auth structure

---

### 3. **Login Server Action** (`src/app/login/action.ts`)

```typescript
'use server'

import { RcfIctClient } from '@rcffuta/ict-lib/server'
import { cookies } from 'next/headers'

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  
  // 1. Initialize ICT Client
  const rcf = RcfIctClient.fromEnv()

  try {
    // 2. Authenticate with ICT lib
    const { user, session } = await rcf.auth.login(email, password)

    if (!user || !session) {
      return { success: false, error: "Invalid credentials" }
    }

    // 3. Set secure HTTP-only cookies
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === 'production'

    const cookieOptions = {
      path: "/",
      httpOnly: true, // Security: JS cannot access
      secure: isProduction,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 1 week
    }

    cookieStore.set("sb-access-token", session.access_token, cookieOptions)
    
    if (session.refresh_token) {
      cookieStore.set("sb-refresh-token", session.refresh_token, cookieOptions)
    }

    // 4. Fetch user profile from ICT lib
    const profile = await rcf.member.getFullProfile(user.id)
    
    // 5. Determine user role (customize this logic)
    const role = determineUserRole(profile) // Implement your logic

    return { success: true, role, profile }

  } catch (error: any) {
    console.error("Login Action Error:", error)
    return { success: false, error: error.message || "Login failed" }
  }
}
```

**Security Features:**

- HTTP-only cookies prevent XSS attacks
- Secure cookies in production
- SameSite protection against CSRF
- Server-side token validation

---

### 4. **Client State Management** (`src/store/auth.store.ts`)

```typescript
import { create } from 'zustand'
import { AuthUser } from '@/types/app.type'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isInitialized: boolean
  
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true, // Default to true until hydrated
  isInitialized: false,
  
  setUser: (user) => set({ user, isLoading: false, isInitialized: true }),
  
  logout: () => {
    set({ user: null, isLoading: false, isInitialized: false })
    // Call server action to clear cookies
    logoutAction()
  }
}))
```

**Key Features:**

- Optimistic updates for better UX
- Loading states for proper UI feedback
- Initialization tracking to prevent hydration issues

---

### 5. **Server-Side Data Fetching** (`src/app/(app)/action.ts`)

```typescript
'use server'

import { ict, ictAdmin } from '@/lib/ict'
import { AuthUser } from '@/types/app.type'
import { cookies } from 'next/headers'

export async function getInitialDashboardData(): Promise<{
  user: AuthUser,
  courses: any[],
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (!token) return null

  try {
    // 1. Validate token with Supabase
    const { data: { user }, error: authError } = await ict.supabase.auth.getUser(token)
    
    if (authError || !user) return null

    // 2. Get full profile from ICT lib
    const profile = await ictAdmin.member.getFullProfile(user.id)
    if (!profile) throw new Error("Profile not found")

    // 3. Fetch user-specific data using admin client
    const { data: courses } = await ictAdmin.supabase
      .from('elib_courses')
      .select('*')
      .order('level', { ascending: false })
      .limit(50)

    // 4. Structure data for client
    return {
      user: {
        id: user.id,
        email: user.email!,
        role: 'USER',
        user: profile
      },
      courses: courses || []
    }

  } catch (error) {
    console.error("Dashboard Fetch Error:", error)
    return null
  }
}
```

**Key Patterns:**

- Always validate tokens server-side
- Use admin client for data fetching to bypass RLS
- Return structured data ready for client consumption
- Handle errors gracefully with null returns

---

### 6. **Route Protection Middleware** (`src/app/middleware.ts`)

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value
  const { pathname } = request.nextUrl

  // Define route types
  const isAuthPage = pathname.startsWith('/login')
  const isAdminPage = pathname.startsWith('/admin')
  const isUserPage = pathname === '/' || pathname.startsWith('/library')

  // Redirect unauthenticated users from protected routes
  if (!token && (isAdminPage || isUserPage)) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users from auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

**Protection Strategy:**

- Cookie-based authentication check
- Automatic redirects for better UX
- Excludes static assets from middleware processing

---

### 7. **State Hydration** (`src/components/providers/StoreInitializer.tsx`)

```typescript
"use client";

import { useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { AuthUser } from "@/types/app.type";

export function StoreInitializer({ user }: { user: AuthUser }) {
    const initialized = useRef(false);

    if (!initialized.current) {
        // Direct state mutation for immediate availability
        useAuthStore.setState({
            user,
            isLoading: false,
            isInitialized: true,
        });
        initialized.current = true;
    }

    return null;
}
```

**Hydration Strategy:**

- Prevents hydration mismatches
- Ensures immediate state availability
- Uses ref to prevent re-initialization

---

### 8. **Page-Level Implementation** (`src/app/(app)/page.tsx`)

```typescript
import { getInitialDashboardData } from "./action";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StoreInitializer } from "@/components/providers/StoreInitializer";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    // 1. Server-side data fetching with auth check
    const data = await getInitialDashboardData();

    // 2. Handle unauthenticated state
    if (!data) {
        redirect("/login");
    }

    return (
        <main className="min-h-screen bg-gray-50/50">
            {/* 3. Hydrate client state */}
            <StoreInitializer user={data.user} />

            {/* 4. Render authenticated content */}
            <DashboardShell initialCourses={data.courses} />
        </main>
    );
}
```

**Key Pattern:**

- Server Components handle authentication
- Client Components handle interactivity
- State initialization happens before rendering

---

## 🚀 **Implementation Guide for New Projects**

### Step 1: **Environment Setup**

```bash
# Install dependencies
npm install @rcffuta/ict-lib zustand

# Environment variables (.env.local)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 2: **Create Core Files**

1. **ICT Client Setup** (`src/lib/ict.ts`)
2. **Auth Types** (`src/types/auth.ts`)
3. **Auth Store** (`src/store/auth.store.ts`)
4. **Login Action** (`src/app/login/action.ts`)
5. **Middleware** (`src/middleware.ts`)

### Step 3: **Implement Authentication Flow**

1. **Login Page** with React Hook Form + Zod validation
2. **Server Actions** for login/logout
3. **Protected Routes** with middleware
4. **State Management** with Zustand
5. **Data Fetching** with server actions

### Step 4: **Add Role-Based Access**

```typescript
// In your data fetching functions
function determineUserRole(profile: FullUserProfile): 'USER' | 'ADMIN' {
  // Implement your role logic based on profile data
  if (profile.department === 'ICT' && profile.role === 'STAFF') {
    return 'ADMIN'
  }
  return 'USER'
}
```

---

## 🛡️ **Security Best Practices**

### ✅ **Implemented Security Features**

1. **HTTP-only Cookies** - Prevents XSS token theft
2. **Secure Cookies** - HTTPS-only in production
3. **SameSite Protection** - CSRF prevention
4. **Server-side Validation** - All auth checks on server
5. **Token Expiration** - Automatic session timeouts
6. **Role-based Access** - Granular permission control

### ⚠️ **Important Considerations**

1. **Never store tokens in localStorage**
2. **Always validate tokens server-side**
3. **Use admin client sparingly**
4. **Implement proper logout cleanup**
5. **Handle token refresh appropriately**

---

## 🔧 **Troubleshooting Common Issues**

### Issue 1: **Hydration Mismatches**

```typescript
// Solution: Use StoreInitializer pattern
<StoreInitializer user={serverUser} />
```

### Issue 2: **Cookie Not Setting**

```typescript
// Ensure correct path and domain
const cookieOptions = {
  path: "/", // CRITICAL: Must be root path
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production'
}
```

### Issue 3: **RLS Permission Denied**

```typescript
// Use admin client for elevated operations
const data = await ictAdmin.supabase.from('table').select('*')
```

---

## 📊 **Architecture Benefits**

1. **Security First** - HTTP-only cookies, server-side validation
2. **Performance** - Server-side data fetching, client hydration
3. **Type Safety** - Full TypeScript integration
4. **Scalability** - Role-based access, modular architecture
5. **Developer Experience** - Clear patterns, comprehensive error handling
6. **Institutional Integration** - Seamless ICT lib integration

---

This architecture provides a robust, secure, and scalable authentication system specifically designed for RCF FUTA applications using the institutional ICT library.
