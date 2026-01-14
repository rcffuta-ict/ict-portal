"use client";

import { useEffect } from "react";
import { useProfileStore } from "../../lib/stores/profile.store";
import { useRouter } from "next/navigation";

export function StoreInitializer() {
    const user = useProfileStore((state) => state.user);
    const navigation = useRouter();


    useEffect(() => {


        async function loadUser() {

            // If we don't have userId, try to load from session (cookie)
            if (!user) {

                // No user found: redirect to login after a short delay
                setTimeout(() => {
                    navigation.replace('/login');
                }, 900);

                return;
            }

    

        }

        loadUser();
    }, []);

    return null; // This component renders nothing visually
}
