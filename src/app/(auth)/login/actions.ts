'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";
// import { cookies } from "next/headers";
// import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const rcf = RcfIctClient.fromEnv();

    try {
        const { user, session } = await rcf.auth.login(email, password);
        
        if (!user || !session) {
            return { success: false, error: "Invalid credentials" };
        }

        // Note: Supabase JS client usually handles cookies automatically 
        // in middleware, but explicitly returning success lets the client redirect.
        return { success: true };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}