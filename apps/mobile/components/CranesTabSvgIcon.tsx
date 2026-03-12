import { SvgXml } from "react-native-svg";

interface CranesTabSvgIconProps {
  color: string;
  size?: number;
}

const CRANES_TAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
  <g stroke="#000000" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 30 30 L 100 30" />
    <path d="M 50 30 L 50 60 M 80 30 L 80 60" />

    <path d="M 20 60 L 280 60 L 250 85 L 20 85 Z" />

    <path d="M 125 60 L 125 85 M 150 60 L 150 85 M 175 60 L 175 85 M 200 60 L 200 85 M 225 60 L 225 85" />

    <path d="M 45 85 L 45 285 M 90 85 L 90 285" />

    <path d="M 45 85 L 90 125 M 45 125 L 90 125 M 45 125 L 90 165 M 45 165 L 90 165 M 45 165 L 90 205 M 45 205 L 90 205 M 45 205 L 90 245 M 45 245 L 90 245 M 45 245 L 90 285 M 45 285 L 90 285" />

    <path d="M 200 85 L 200 145" />

    <circle cx="200" cy="153" r="10" />

    <path d="M 194 158 L 125 180 M 206 158 L 275 180" />

    <rect x="125" y="180" width="150" height="84" rx="8" />
  </g>

  <g fill="#000000">
    <rect x="141" y="194" width="10" height="56" rx="5" />
    <rect x="159" y="194" width="10" height="56" rx="5" />
    <rect x="177" y="194" width="10" height="56" rx="5" />
    <rect x="195" y="194" width="10" height="56" rx="5" />
    <rect x="213" y="194" width="10" height="56" rx="5" />
    <rect x="231" y="194" width="10" height="56" rx="5" />
    <rect x="249" y="194" width="10" height="56" rx="5" />
  </g>
</svg>`;

export function CranesTabSvgIcon({ color, size = 26 }: CranesTabSvgIconProps) {
  return <SvgXml xml={CRANES_TAB_SVG.replaceAll("#000000", color)} width={size} height={size} />;
}
