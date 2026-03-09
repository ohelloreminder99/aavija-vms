'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from "@/supabase";
import { useUserProfile } from "@/services/user-service";
import { Star, StarHalf } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const RatingCardComponent = () => {
    const { user, isUserLoading } = useUser();
    const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
    const isLoading = isUserLoading || isProfileLoading;

    const renderStars = (rating: number) => {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        return (
            <div className="flex items-center gap-1 text-amber-500">
                {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} className="h-5 w-5 fill-current" />)}
                {halfStar && <StarHalf key="half" className="h-5 w-5 fill-current" />}
                {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} className="h-5 w-5" />)}
            </div>
        )
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-full mt-2" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Global Rating</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{userProfile?.global_rating?.toFixed(1) ?? '0.0'}</span>
                    <span className="text-muted-foreground">/ 5</span>
                </div>
                <div className="mt-2">
                    {renderStars(userProfile?.global_rating ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    This is your average rating from all hosts.
                </p>
            </CardContent>
        </Card>
    );
}

export const RatingCard = React.memo(RatingCardComponent);

