/**
 * The background player's playlist. A track with `src` plays real audio (put the
 * file in public/audio/ or use a licensed host's direct URL). A track without `src`
 * is a placeholder: the player fakes playback so the controls can be tried.
 * Replace these once the lofi source is licensed (see the plan's Open questions).
 */
export interface Track {
  title: string;
  artist: string;
  /** Length in seconds; read from the file when `src` is set. */
  length: number;
  src?: string;
}

export const TRACKS: Track[] = [
  { artist: 'Placeholder Artist', title: 'Dial-Up Dreams', length: 214 },
  { artist: 'Sample Band', title: 'Away Message', length: 187 },
  { artist: 'Lofi Stand-in', title: 'Screensaver Sunset', length: 243 },
  { artist: 'Demo Crew', title: 'Burned CD Track 7', length: 199 },
];
