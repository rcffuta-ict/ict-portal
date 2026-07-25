"use client";

import { useTenureStore } from "@/lib/stores/tenure.store";
import { getActiveTenure } from "@/utils/action";
import { useEffect } from "react";

export function TenureInitializer() {
    const setTenure = useTenureStore((state) => state.setTenure);
    // const navigation = useRouter();


    useEffect(() => {


        async function loadTenure() {

            try {
                const tenure = await getActiveTenure();

                if (tenure) {
                    setTenure(tenure);
                }

            }catch(error) {
                console.error("Error initializing tenure store:", error);
            }

    

        }

        loadTenure();
    }, []);

    return null; // This component renders nothing visually
}
