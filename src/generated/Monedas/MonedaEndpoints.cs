// ========================================================
// Api.Endpoints.MonedaEndpoints.cs
// ========================================================
namespace Api.Endpoints {

  using Microsoft.AspNetCore.Builder;
  using Microsoft.AspNetCore.Http;
  using Microsoft.AspNetCore.Routing;
  using Negocio.Entities;
  using Dal.Core;

  public static class MonedaEndpoints {

    public static void MapMonedaEndpoints(this IEndpointRouteBuilder app) {
      var group = app.MapGroup("/api/monedas").WithTags("Monedas");

      group.MapGet("/", () => {
        var lista = new Monedas();
        return Results.Ok(lista.Load());
      });

      group.MapGet("/{id:long}", (long id) => {
        var item = new Moneda().Load(id);
        if (item == null) return Results.NotFound();
        return Results.Ok(item);
      });

      group.MapPost("/", (Moneda moneda) => {
        var item = new Moneda() {
          Descripcion = moneda.Descripcion
        };
        item.Save();
        return Results.Created($"/api/monedas/{item.Id}", item);
      });

      group.MapPut("/{id:long}", (long id, Moneda moneda) => {
        var item = new Moneda().Load(id);
        if (item == null) return Results.NotFound();
        item.Descripcion = moneda.Descripcion;
        item.Save();
        return Results.Ok(item);
      });

      group.MapDelete("/{id:long}", (long id) => {
        var item = new Moneda().Load(id);
        if (item == null) return Results.NotFound();
        item.Delete();
        return Results.NoContent();
      });
    }
  }
}