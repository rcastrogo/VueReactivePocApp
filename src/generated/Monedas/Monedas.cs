// ========================================================
// Negocio.Monedas.cs
// ========================================================    
namespace Negocio.Entities {
  using Dal.Core;
  using Dal.Repositories;
  using Negocio.Core;
  using System.Collections.Generic;
  using Dal.Core.Queries;
  using System.Linq;

  [System.Xml.Serialization.XmlRoot("Monedas")]
  public class Monedas : EntityList<Moneda> {
    public Monedas() { }
    public Monedas(DbContext context) : base(context) { }
        
    public Monedas(IEnumerable<Moneda> values) : base() {
      values.ToList().ForEach( u => Add(u));
    }

    public Monedas Load() {
      using (MonedasRepository repo = new MonedasRepository(base.DataContext)) {
        return (Monedas)repo.Load<Moneda>(this, repo.GetItems());
      }
    }
  }
}