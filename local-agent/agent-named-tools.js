// @ts-nocheck

const handler = {
  'send-message': async (args) => {
    console.log(`Sending message with arguments:`, args);
    return { 
      status: 'success',
      message: 'Mensaje enviado correctamente.' 
    };
  },
  'query-events': async (args) => {
    console.log(`Querying events with arguments:`, args);
    return {
      "status": "success",
      "events": [
        { "title": "Reunión de arquitectura", "time": "11:00" }
      ]
    };
  },
  'reserve-room': async (args) => {
    console.log(`Reserving room with arguments:`, args);
    return { 
      status: 'success',
      message: 'Sala reservada correctamente. Debes enviar un mensaje a "reserva-de-salas" con un texto explicativo para que la reserva sea confirmada. Utiliza info-reserva.',
      "info-reserva": { 
        room_id: 'SALA_1', 
        text: 'Las llaves se encuentran en recepción.' 
      }
    };
  },
  'facturacion': async (args) => {
    console.log(`Processing billing with arguments:`, args);
    if(args.action === 'informes') {
      return { 
        status: 'success',
        items: [ 'report 1', 'report 2', 'report 3' ]
      };
    } else if(args.action === 'facturas') {
      return { 
        status: 'success',
        items: [ 'factura 1', 'factura 2', 'factura 3' ]
      };
    } else if(args.action === 'pagos') {
      return { 
        status: 'success',
        items: [ 'pago 1', 'pago 2', 'pago 3' ]
      };
    } else if(args.action === 'generar-remesa') {
      const secret = args.args?.secret || args.args.clave;
      if(!secret) {
        return {
          status: 'error',
          message: 'Para generar la remesa se requiere la clave secreta (secret).'
        };
      }
      return { 
        status: 'success',
        message: `
          Se ha generado la remesa correctamente y se ha enviado para su procesamiento.
          puede comporbarlo en el siguiente enlace: http://example.com/remesas/25
        ` 
      };
    }
    return {
      status: 'success',
      message: 'La acción no es válida. Acciones disponibles',
      actions: [ 'informes', 'facturas', 'pagos', 'generar-remesa'],
    };
  }
}

export async function namedToolfunc(args = {}) {
  if (!args.tool) return { error: 'El nombre de la herramienta es obligatorio.'};
  if (!args.args) return { error: 'Los argumentos de la herramienta son obligatorios.'};
  try {
    const toolHandler = handler[args.tool];
    const toolArgs = JSON.parse(args.args);
    if(toolHandler) return await handler[args.tool](toolArgs);
    return { error: 'Herramienta no encontrada.' };
  } catch (err) {
    console.error(`Error running named tool: ${err.message}`);
    return { error: err.message };
  }
}
