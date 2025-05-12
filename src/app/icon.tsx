import { ImageResponse } from 'next/og'
import { Leaf } from 'lucide-react';

// Route segment config
export const runtime = 'edge'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  // Using a prominent color from the theme (primary) for the icon
  const iconColor = '#4CAF50'; // Muted Green (same as primary HSL: 120 39% 47%)

  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 24,
          background: 'transparent', // Use transparent background
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Removed text color as we color the icon directly
        }}
      >
        <Leaf color={iconColor} size={24} />
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    }
  )
}
