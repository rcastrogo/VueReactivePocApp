// ========================================================      
// TiposRepository.cs
// ========================================================
namespace Dal.Repositories {
  using Dal.Core;
  using Dal.Core.Loader;
  using Dal.Core.Queries;
  using System.Collections.Generic;
  using System.Data;

  [RepoName("Dal.Repositories.TiposRepository")]
  public class TiposRepository : RepositoryBase {
  
    public TiposRepository(DbContext context) : base(context) { }
        
    public IDataReader GetItems(ParameterBag bag){
      var __builder = new SqlWhereClauseBuilder(bag)
              .And("DESCRIPCION", "DESCRIPCION")
            .AndListOf<long>("Ids", "id"); 
      return GetItems(__builder);
    }
    
    public long Insert(string Descripcion) { 
      return Insert(new ParameterBag()
                          .Use("DESCRIPCION", Descripcion));                
    }
  
    public int Update(int Id, string Descripcion) {
      return Update(new ParameterBag()
                          .Use("ID_TIPO", Id)
                          .Use("DESCRIPCION", Descripcion));            
    }
  }
}