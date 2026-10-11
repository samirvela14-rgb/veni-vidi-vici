import { Circle } from 'lucide-react'
import { ICONOS } from './iconos'

export default function Icono({ nombre, size = 18, ...props }) {
  const Componente = ICONOS[nombre] || Circle
  return <Componente size={size} strokeWidth={1.75} {...props} />
}
