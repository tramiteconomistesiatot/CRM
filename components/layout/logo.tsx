interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export function TramitLogo({ size = 'md', variant = 'full' }: LogoProps) {
  const sizes = {
    sm: { width: 110, height: 68 },
    md: { width: 150, height: 93 },
    lg: { width: 200, height: 124 },
  }

  const { width, height } = sizes[size]

  if (variant === 'icon') {
    return (
      <div
        style={{ width: 40, height: 40 }}
        className="rounded-lg overflow-hidden bg-white flex items-center justify-center p-1"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo tramit.png"
          alt="Tràmit Economistes"
          width={36}
          height={36}
          style={{ objectFit: 'contain' }}
        />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo tramit.png"
      alt="Tràmit Economistes"
      width={width}
      height={height}
      style={{ objectFit: 'contain' }}
    />
  )
}
