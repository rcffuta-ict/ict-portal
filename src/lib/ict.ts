import { RcfIctClient } from '@rcffuta/ict-lib/server'

// 1. The ICT Client (For Auth, User Profiles, Departments)
// This runs only on the server
export const ict = RcfIctClient.fromEnv()
export const ictAdmin = RcfIctClient.asAdmin();

// 2. The Supabase Admin Client (For E-Lib specific DB operations)
// Using service role key to bypass RLS when acting as Admin
// export const supabaseAdmin = RcfIctClient.asAdmin()//createClient(supabaseUrl, supabaseServiceKey)
// export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// 3. Helper to get User Context
export async function getCurrentUser() {
  try {
    // Get auth session
    const { data: { session } } = await ict.supabase.auth.getSession()
    if (!session) return null

    // Get full profile from ICT Lib
    const profile = await ict.member.getFullProfile(session.user.id)
    return profile
  } catch (error) {
    console.error('Error fetching user context:', error)
    return null
  }
}