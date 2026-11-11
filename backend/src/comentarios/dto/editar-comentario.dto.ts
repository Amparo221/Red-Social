import { CrearComentarioDto } from './crear-comentario.dto';

/**
 * Cuerpo del PATCH /comentarios/:comentarioId.
 *
 * Editar sólo cambia el texto, así que las validaciones son idénticas a las de
 * crear (recorte de espacios, no vacío, largo máximo). Heredamos el DTO en vez
 * de copiarlas para que un cambio de regla no quede en un solo lado.
 */
export class EditarComentarioDto extends CrearComentarioDto {}
