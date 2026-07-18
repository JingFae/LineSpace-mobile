import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop
} from "react-native-svg";

export type ProfileBadgeVariant = "creator" | "reviewer";

export function ProfileBadgeArtwork({
  variant,
  size = 64,
  muted = false
}: {
  variant: ProfileBadgeVariant;
  size?: number;
  muted?: boolean;
}) {
  const creator = variant === "creator";
  const gold = muted ? "#C8C2B7" : "#F8B500";
  const ink = muted ? "#D8D4CE" : "#B8860B";
  const night = muted ? "#C7C4BF" : "#475569";
  const glow = muted ? "#E6E1D9" : "#FDE047";

  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Defs>
        <LinearGradient id="badgeGold" x1="0%" x2="100%" y1="0%" y2="100%">
          <Stop offset="0%" stopColor="#FCEABB" />
          <Stop offset="100%" stopColor={gold} />
        </LinearGradient>
        <LinearGradient id="badgeNight" x1="0%" x2="100%" y1="0%" y2="100%">
          <Stop offset="0%" stopColor={night} />
          <Stop offset="100%" stopColor="#1E293B" />
        </LinearGradient>
      </Defs>
      {creator ? (
        <>
          <Circle cx="50" cy="50" fill="#FFFAF0" r="45" stroke="url(#badgeGold)" strokeWidth="3" />
          <Circle cx="50" cy="50" fill="none" r="38" stroke={gold} strokeDasharray="3 4" strokeWidth="1" />
          <Path
            d="M69 17c-9 8-16 19-22 33-5 11-13 18-27 26 10 1 24-6 32-16 10-13 14-29 17-43Z"
            fill="url(#badgeGold)"
          />
          <Path d="M20 76 69 17" fill="none" stroke="#FFF" strokeLinecap="round" strokeWidth="2.3" />
          <Path d="m39 56 13-8M47 46l13-10" fill="none" opacity=".65" stroke="#FFF" strokeLinecap="round" strokeWidth="1.4" />
          <Path d="M75 66c0 5-4 9-9 9s-9-4-9-9c0-7 9-17 9-17s9 10 9 17Z" fill={ink} />
        </>
      ) : (
        <>
          <Circle cx="50" cy="50" fill="url(#badgeNight)" r="45" stroke="#94A3B8" strokeWidth="2" />
          <Circle cx="50" cy="50" fill="none" r="34" stroke={glow} strokeOpacity=".3" strokeWidth="1.5" />
          <Circle cx="50" cy="50" fill={glow} fillOpacity=".18" r="24" />
          <Path d="M38 33c-9 6-7 15-3 20M62 33c9 6 7 15 3 20" fill="none" stroke="#94A3B8" strokeLinecap="round" strokeWidth="3" />
          <Path d="m37 49 26 0-4-8H41Z" fill={night} stroke="#94A3B8" strokeWidth="1" />
          <Path d="m39 49 22 0 4 33H35Z" fill="none" stroke="#94A3B8" strokeWidth="2" />
          <Path d="M50 59c-4 7-7 10-7 14 0 4 3 6 7 6s7-2 7-6c0-4-3-7-7-14Z" fill="#F59E0B" />
          <Path d="M50 64c-2 4-3 6-3 9 0 2 1 3 3 3s3-1 3-3c0-3-1-5-3-9Z" fill="#FEF3C7" />
          <Rect fill={night} height="5" rx="2" width="42" x="29" y="81" />
        </>
      )}
    </Svg>
  );
}
