// ========================================================
// Negocio.Tipos.cs
// ========================================================    
namespace Negocio.Entities {
  using Dal.Core;
  using Dal.Repositories;
  using Negocio.Core;
  using System.Collections.Generic;
  using Dal.Core.Queries;
  using System.Linq;

  [System.Xml.Serialization.XmlRoot("Tipos")]
  public class Tipos : EntityList<Tipo> {
    public Tipos() { }
    public Tipos(DbContext context) : base(context) { }
        
    public Tipos(IEnumerable<Tipo> values) : base() {
      values.ToList().ForEach( u => Add(u));
    }

    public Tipos Load() {
      using (TiposRepository repo = new TiposRepository(base.DataContext)) {
        return (Tipos)repo.Load<Tipo>(this, repo.GetItems());
      }
    }
  }
}