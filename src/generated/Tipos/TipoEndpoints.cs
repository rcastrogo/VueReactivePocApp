// ========================================================
// Api.Endpoints.TipoEndpoints.cs
// ========================================================
namespace Api.Endpoints {

  using Microsoft.AspNetCore.Builder;
  using Microsoft.AspNetCore.Http;
  using Microsoft.AspNetCore.Routing;
  using Negocio.Entities;
  using Dal.Core;

  public static class TipoEndpoints {

    public static void MapTipoEndpoints(this IEndpointRouteBuilder app) {
      var group = app.MapGroup("/api/tipos").WithTags("Tipos");

      group.MapGet("/", () => {
        var lista = new Tipos();
        return Results.Ok(lista.Load());
      });

      group.MapGet("/{id:long}", (long id) => {
        var item = new Tipo().Load(id);
        if (item == null) return Results.NotFound();
        return Results.Ok(item);
      });

      group.MapPost("/", (Tipo tipo) => {
        var item = new Tipo() {
          Descripcion = tipo.Descripcion
        };
        item.Save();
        return Results.Created($"/api/tipos/{item.Id}", item);
      });

      group.MapPut("/{id:long}", (long id, Tipo tipo) => {
        var item = new Tipo().Load(id);
        if (item == null) return Results.NotFound();
        item.Descripcion = tipo.Descripcion;
        item.Save();
        return Results.Ok(item);
      });

      group.MapDelete("/{id:long}", (long id) => {
        var item = new Tipo().Load(id);
        if (item == null) return Results.NotFound();
        item.Delete();
        return Results.NoContent();
      });
    }
  }
}