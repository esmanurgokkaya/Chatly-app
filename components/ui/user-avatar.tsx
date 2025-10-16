"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocket } from "@/context/socket-context";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId: string;
  imageUrl?: string;
  name?: string;
  className?: string;
}

export function UserAvatar({ userId, imageUrl, name, className }: UserAvatarProps) {
  const { onlineUsers } = useSocket();
  const isOnline = onlineUsers.includes(userId);

  return (
    <div className="relative">
      <Avatar className={cn("h-8 w-8", className)}>
        <AvatarImage src={imageUrl} />
        <AvatarFallback>{name?.[0] || "U"}</AvatarFallback>
      </Avatar>
      {isOnline && (
        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
      )}
    </div>
  );
}