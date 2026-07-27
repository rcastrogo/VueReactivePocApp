// ========================================================
// Negocio.Tipo.cs
// ========================================================
namespace Negocio.Entities {
  using Dal.Core;
  using Dal.Repositories;
  using Negocio.Core;
  using System;

  [Serializable()]
  public class Tipo : Entity {
    public Tipo() { }
    public Tipo(DbContext context) : base(context) { }

    public Tipo Load() {
      return Load(Id);
    }
    
    public Tipo Load(long id) {    
      using (TiposRepository repo = new TiposRepository(DataContext)) {
        return repo.LoadOne<Tipo>(this, repo.GetItem(id));
      }   
    }

    public Tipo Save() {
      using (TiposRepository repo = new TiposRepository(DataContext)) {
        if (_id == 0) {
          _id = repo.Insert(Descripcion);
        } else {
          repo.Update(Id, Descripcion);
        }
        return this;
      }
    }
            
    public void Delete() {
      using (TiposRepository repo = new TiposRepository(DataContext)) {
        repo.Delete(_id);
      }
    }

    private int _id;
    public override int Id {
      get { return _id; }
      
    }

    private string _descripcion;
    public string Descripcion {
      get { return _descripcion; }
      set { _descripcion = value; }
    }
  }
}