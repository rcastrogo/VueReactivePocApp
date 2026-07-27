// ========================================================
// Negocio.Moneda.cs
// ========================================================
namespace Negocio.Entities {
  using Dal.Core;
  using Dal.Repositories;
  using Negocio.Core;
  using System;

  [Serializable()]
  public class Moneda : Entity {
    public Moneda() { }
    public Moneda(DbContext context) : base(context) { }

    public Moneda Load() {
      return Load(Id);
    }
    
    public Moneda Load(long id) {    
      using (MonedasRepository repo = new MonedasRepository(DataContext)) {
        return repo.LoadOne<Moneda>(this, repo.GetItem(id));
      }   
    }

    public Moneda Save() {
      using (MonedasRepository repo = new MonedasRepository(DataContext)) {
        if (_id == 0) {
          _id = repo.Insert(Descripcion);
        } else {
          repo.Update(Id, Descripcion);
        }
        return this;
      }
    }
            
    public void Delete() {
      using (MonedasRepository repo = new MonedasRepository(DataContext)) {
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