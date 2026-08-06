import React from 'react'
import { useLingui } from '@lingui/react'
import { t } from '@lingui/macro'
import { Basemap } from './basemap'

interface LayerSwitcherProps {
  mode: Basemap;
  onToggle: (mode: Basemap) => void;
}

export function LayerSwitcher({ mode, onToggle }: LayerSwitcherProps) {
  useLingui()
  let isAerial = mode === 'aerial'
  const label = isAerial ? t`地図` : t`航空写真`
  const thumb =
    isAerial
      ? `${process.env.PUBLIC_URL}/map-thumb.png`
      : `${process.env.PUBLIC_URL}/aerial-thumb.png`
  return (
    <button
      type="button"
      className="layer-switch"
      title={isAerial ? t`地図に切り替え` : t`航空写真に切り替え`}
      onClick={() => onToggle(isAerial ? 'map' : 'aerial')}
    >
      <img src={thumb} alt={label} />
      <span className="layer-switch-label">{label}</span>
    </button>
  )
}
