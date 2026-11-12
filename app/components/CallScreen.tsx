
"use client";

import {
  LiveKitRoom,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";

type CallScreenProps = {
  token: string;
  serverUrl: string;
  callType: "audio" | "video";
  onLeave: () => void;
};

export default function CallScreen({
  token,
  serverUrl,
  callType,
  onLeave,
}: CallScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#080d18]">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={true}
        video={callType === "video"}
        onDisconnected={onLeave}
        className="h-full w-full"
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
