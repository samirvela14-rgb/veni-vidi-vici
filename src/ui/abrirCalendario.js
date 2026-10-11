// Abre el calendario (o el reloj) de un <input type="date"> o <input type="time"> escondido dentro de un botón.
// Sin esto, el navegador solo lo abre al tocar el ícono del calendario.
export function abrirCalendario(evento) {
  evento.preventDefault()
  const input = evento.currentTarget.querySelector('input[type="date"], input[type="time"]')
  if (!input) return
  try {
    input.showPicker()
  } catch {
    input.focus()
    input.click()
  }
}
