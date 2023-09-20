import type {
  CurOrmStoreType,
  CurOperType,
  MyObject,
  OrderByType,
  WhereConnectType,
  WhereItem,
  WhereType,
  DataType,
  TableFieldsOption
} from "types";

/** 构建 update when 配置 */
export type BuildUpdateByWhenOption<T = any> = {
  /** 操作的数据 */
  datas: T[];
  /** 一次最大更新多少条数据 */
  onceMaxUpdateDataLength?: number;

  /** 字段数据 */
  fieldOpts: {
    /** SET xxx 里的 xxx 字段 */
    setField: string;

    /** WHEN xxx=yyy 里的 xxx 数据 */
    getWhenField: (row: T) => string | number;

    /** WHEN xxx=yyy 里的 yyy 数据 */
    getWhenValue: (row: T) => string | number;

    /** THEN xxx=yyy 里的 yyy 数据 */
    getThenValue: (row: T) => string | number;
  }[];

  /** 额外的 updateWhen 子句 */
  getExtraUpdateWhen?: (updates: T[]) => string;

  /** 额外的 where 子句 */
  getExtraWhere?: (updates: T[]) => string;
};

/**
 * SQLite ORM
 */
class SqliteOrm {
  private curOrmStore: CurOrmStoreType = SqliteOrm.getDefaultCurOrmStore();

  constructor(private tableName: string) {}

  /** 获取默认的ORM方法 */
  static getDefaultCurOrmStore(): CurOrmStoreType {
    return {
      insert: undefined,
      delect: undefined,
      update: undefined,
      select: undefined,
      count: undefined,

      groupBy: undefined,
      where: undefined,
      and: undefined,
      or: undefined,
      limit: undefined
    };
  }

  /** 获取表名称 */
  getTableName() {
    return this.tableName;
  }

  /** 修改表名称 */
  setTableName(tableName: string) {
    this.tableName = tableName;
    return this;
  }

  /** 清除ORM状态 */
  private clearCurOrmStore() {
    this.curOrmStore = SqliteOrm.getDefaultCurOrmStore();
    return this;
  }

  /**
   * 清除状态
   */
  clear() {
    return this.clearCurOrmStore();
  }

  /** 设置操作状态 */
  setOperStore<T extends CurOperType>(key: T, value: CurOrmStoreType[T]) {
    // 重置其它操作类型
    this.curOrmStore = {
      ...this.curOrmStore,
      select: undefined,
      delect: undefined,
      update: undefined,
      count: undefined,
      [key]: value
    };
    // 保存当前的操作类型
    this.curOrmStore.curOper = key;
    return this;
  }

  /**
   * 生成 INSERT 语句
   * @param data 插入的数据
   * @returns `string`
   */
  inser<T extends MyObject>(data: T) {
    this.clear();
    const values = this.buildInsertValues([data]);
    return `INSERT or REPLACE INTO "${this.tableName}" ${values}`;
  }

  /**
   * 批量生成 INSERT 语句
   * @param datas 插入的数据
   * @param maxSize 因为 sqlite 存在限制, 一次sql最多只能插入999个变量的值, 这里参数进行控制
   * @returns `string[]`
   */
  insers<T extends MyObject[]>(datas: T, maxSize = 999) {
    this.clear();
    // 一次最多可以保存多少个字段的数据
    // const MAX_SIZE = 999;
    if (datas.length === 0) {
      return "";
    }

    // 这里取第0项的字段信息
    const fields = Object.keys(datas[0]);

    // 计算一次需要保存多少条数据
    const maxSaveDataNum = Math.floor(maxSize / fields.length);

    const allData = this.dataSlice({
      datas,
      onceMaxDataLength: maxSaveDataNum
    });

    return allData.map(items => {
      // 这里要返回一个数组, 因为一次最多插入 999 个值
      const values = this.buildInsertValues(items);
      return `INSERT or REPLACE INTO "${this.tableName}" ${values}`;
    });
  }

  delect() {
    return this.setOperStore("delect", true);
  }

  update<T extends MyObject>(obj: T) {
    return this.setOperStore("update", obj);
  }

  select(field = "*") {
    return this.setOperStore("select", field);
  }

  count(field: string) {
    return this.setOperStore("count", field.startsWith("count(") ? `count(${field})` : field);
  }

  groupBy(field: string) {
    this.curOrmStore.groupBy = field;
    return this;
  }

  orderBy(order: OrderByType, field: string) {
    this.curOrmStore.orderBy = [order, field];
    return this;
  }

  // 构建 where 项
  private buildWhereItem(key: string, connect: WhereConnectType, value: any) {
    const spec: WhereConnectType[] = ["IN", "IS NOT", "NOT", "like"];
    const _connect = spec.includes(connect) ? ` ${connect} ` : connect;

    let _value: any = "";
    if (value) {
      if (typeof value === "string") {
        _value = `"${value}"`;
      } else if (connect === "IN" && Array.isArray(value)) {
        const v = value
          .map(e => {
            if (typeof e === "string") {
              return `"${e}"`;
            } else {
              return e;
            }
          })
          .join(",");

        _value = `(${v})`;
      } else {
        _value = value;
      }
    } else {
      // 如果是布尔值, 则 true = 1, false = 0
      if (typeof value === "boolean") {
        _value = value ? 1 : 0;
      }
    }
    return `${key}${_connect}${_value}`;
  }

  /** 设置 WHERE */
  where(key: string, connect: WhereConnectType, value: any) {
    this.curOrmStore.isSetWhere = true;
    const str = this.buildWhereItem(key, connect, value);
    if (this.curOrmStore.where) {
      this.curOrmStore.where.unshift(str);
    } else {
      this.curOrmStore.where = [str];
    }
    return this;
  }

  /** 设置 AND */
  and(key: string, connect: WhereConnectType, value: any) {
    const item: WhereItem = { key, connect, value };
    if (!this.curOrmStore.and) {
      this.curOrmStore.and = [item];
    } else {
      this.curOrmStore.and.push(item);
    }

    const str = this.buildWhereItem(key, connect, value);
    if (this.curOrmStore.where) {
      if (this.curOrmStore.where[this.curOrmStore.where.length - 1] === "(") {
        this.curOrmStore.where.push(str);
      } else {
        this.curOrmStore.where.push("AND", str);
      }
    } else {
      this.curOrmStore.where = ["AND", str];
    }
    return this;
  }

  /** 设置 OR */
  or(key: string, connect: WhereConnectType, value: any) {
    const item: WhereItem = { key, connect, value };
    if (this.curOrmStore.or) {
      this.curOrmStore.or.push(item);
    } else {
      this.curOrmStore.or = [item];
    }

    const str = this.buildWhereItem(key, connect, value);
    if (this.curOrmStore.where) {
      if (this.curOrmStore.where[this.curOrmStore.where.length - 1] === "(") {
        this.curOrmStore.where.push(str);
      } else {
        this.curOrmStore.where.push("OR", str);
      }
    } else {
      this.curOrmStore.where = ["OR", str];
    }
    return this;
  }

  // 数组构建
  private buildWhereArrayItem(key: string, connect: WhereConnectType, value: any[], whereType: WhereType) {
    if (value.length) {
      this.curOrmStore.isSetWhere = true;
    }

    if (this.curOrmStore.where) {
      this.curOrmStore.where.push(whereType, "(");
    } else {
      this.curOrmStore.where = ["("];
    }

    value.forEach(e => {
      if (whereType === "AND") {
        this.and(key, connect, e);
      } else if (whereType === "OR") {
        this.or(key, connect, e);
      }
    });

    this.curOrmStore.where.push(")");

    return this;
  }

  /** 批量设置 WHERE */
  whereArray(key: string, connect: WhereConnectType, value: any[], whereType: WhereType) {
    if (value.length) {
      this.buildWhereArrayItem(key, connect, value, whereType);
    } else {
      console.warn("空数组 WHERE 条件");
    }
    return this;
  }

  /** 批量设置 WHERE OR */
  orArray(key: string, connect: WhereConnectType, value: any[]) {
    if (value.length) {
      this.buildWhereArrayItem(key, connect, value, "OR");
    } else {
      console.warn("空数组 WHERE 条件");
    }
    return this;
  }

  /** 批量设置 WHERE AND */
  andArray(key: string, connect: WhereConnectType, value: any[]) {
    if (value.length) {
      this.buildWhereArrayItem(key, connect, value, "AND");
    } else {
      console.warn("空数组 WHERE 条件");
    }
    return this;
  }

  /** 设置 LIMIT */
  limit(limit: number, offset: number) {
    this.curOrmStore.limit = [limit, offset];
    return this;
  }

  /** 获取原始sql语句 */
  getSqlRaw() {
    return this.buildRawSql();
  }

  /** 生成 WHERE */
  private buildWhere() {
    const where = this.curOrmStore.where;

    // 如果没有调用 where 则删除第一项
    if (where && !this.curOrmStore.isSetWhere) {
      where.shift();
    }
    return where && where.length ? `WHERE ${where.join(" ")}` : "";
  }

  /** 生成 GROUP BY */
  private buildGroupBy() {
    const groupBy = this.curOrmStore.groupBy;
    return groupBy ? `GROUP BY ${groupBy}` : "";
  }

  /** 生成 ORDER BY */
  private buildOrderBy() {
    const orderBy = this.curOrmStore.orderBy;
    return orderBy && orderBy.length ? `ORDER BY ${orderBy[1]} ${orderBy[0]}` : "";
  }

  /** 生成 LIMIT */
  private buildLimit() {
    const limit = this.curOrmStore.limit;
    return limit && limit.length ? `LIMIT ${limit[0]},${limit[1]}` : "";
  }

  /** 生成 INSERT VLAUES */
  private buildInsertValues(insertDatas?: any[]) {
    if (!insertDatas || insertDatas.length === 0) {
      return "";
    }

    // 这里取第0项的字段信息
    const fields = Object.keys(insertDatas[0]);
    const fieldSql = `(${fields.join(", ")}) VALUES`;

    const allData: any[][] = [];
    insertDatas.forEach(insertData => {
      const val: any[] = [];
      fields.forEach(field => {
        for (const key in insertData) {
          if (Object.prototype.hasOwnProperty.call(insertData, key)) {
            if (field === key) {
              const v = insertData[key];
              if (v && typeof v === "string") {
                val.push(`"${v}"`);
              } else {
                // 如果是布尔值, true = 1, false = 0
                if (typeof v === "boolean") {
                  val.push(v ? 1 : 0);
                } else {
                  val.push(v);
                }
              }
            }
          }
        }
      });
      allData.push(val);
    });
    const values = allData
      .map(item => {
        const v = item.join(", ");
        return `(${v})`;
      })
      .join(", ");

    return `${fieldSql} ${values}`;

    // const { sql: _sql, params } = await this.buildInsertSql([insertData]);
  }

  /** 生成 sql */
  buildRawSql(): string {
    const curOper = this.curOrmStore.curOper;
    if (!curOper) {
      return "";
    }

    let sql = "";
    let values: any[] = [];
    const operMap = {
      delect: "DELETE FROM",
      update: "UPDATE",
      select: `SELECT ${this.curOrmStore.select} FROM`,
      count: `SELECT count(${this.curOrmStore.count}) FROM`
    };

    sql = `${operMap[curOper]} "${this.tableName}"`;

    const whereSql = this.buildWhere();
    const groupBySql = this.buildGroupBy();
    const orderBySql = this.buildOrderBy();
    const limitSql = this.buildLimit();
    const otherSql = `${whereSql} ${groupBySql} ${orderBySql} ${limitSql}`;

    if (curOper === "delect") {
      sql = `${sql} ${otherSql}`;
    } else if (curOper === "update") {
      const updateData = this.curOrmStore.update;
      if (updateData) {
        // TODO
        // const { fields, values: _value } = this.getDataInfo(updateData);
        const fields = Object.keys(updateData);
        const _value = Object.values(updateData);
        // const setSql = fields.map(e => `${e}=?`).join(", ");
        const setSql = fields.map((e, i) => `${e}="${values[i]}"`).join(", ");

        sql = `${sql} SET ${setSql} ${otherSql}`;
        values = _value;
      }
    } else if (curOper === "select" || curOper === "count") {
      sql = `${sql} ${otherSql}`;
    }

    this.clearCurOrmStore();
    return sql.replace(/\s+/g, " ").trim();
  }

  /**
   * 新增列
   * @param field 字段名
   * @param type 类型
   * @param tableName 表名
   * @returns `string`
   */
  addColumn(field: string, type: DataType, tableName = this.tableName) {
    this.clear();
    return `ALTER TABLE "${tableName}" ADD ${field} ${type};`;
  }

  /**
   * 数据切片
   */
  public dataSlice<T = any>(opt: {
    /** 需要切片数据 */
    datas: T[];
    /** 一份的最大长度 */
    onceMaxDataLength: number;
  }) {
    this.clear();
    // 一次最大的数据长度
    const ONCE_MAX_LENGTH = opt.onceMaxDataLength;
    // 克隆数据
    const _datas: T[] = JSON.parse(JSON.stringify(opt.datas));

    // 计算需要切分多少次
    const sliceNum = Math.ceil(_datas.length / ONCE_MAX_LENGTH);

    const result: T[][] = [];

    for (let offset = 0; offset < sliceNum; offset++) {
      // 分批次截取数据
      const sliceData = _datas.slice(offset * ONCE_MAX_LENGTH, (offset + 1) * ONCE_MAX_LENGTH);
      result.push(sliceData);
    }

    return result;
  }

  /**
   * 执行 update when 语句(支持大数据量, 内部会做切分执行), 参考`$buildUpdateByWhen`
   */
  buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>) {
    this.clear();
    if (opt.datas.length === 0) {
      console.warn("数组数据为空");
      return [];
    }

    const sqls = [];

    // 切片数据
    const dataSlice = this.dataSlice({
      datas: opt.datas,
      onceMaxDataLength: opt.onceMaxUpdateDataLength || 999
    });

    for (let i = 0; i < dataSlice.length; i++) {
      const itemSql = this.$buildUpdateByWhen({
        datas: dataSlice[i],
        onceMaxUpdateDataLength: opt.onceMaxUpdateDataLength,
        fieldOpts: opt.fieldOpts,
        getExtraUpdateWhen: opt.getExtraUpdateWhen,
        getExtraWhere: opt.getExtraWhere
      });
      sqls.push(itemSql);
    }

    return sqls;
  }

  /**
   * 执行 update when 语句, 这个方法最多一次只能更新999条数据
   * - 不然会报错 `sqlite3_prepare_v2 failure: Expression tree is too large (maximum depth 1000)`
   * - 请使用`updateByWhen`
   *
   * ```ts
   * const updateByWhenRes = await this.$buildUpdateByWhen({
   * 	datas: data,
   * 	fieldOpts: [
   * 		{
   * 			setField: "tidCode",
   * 			getWhenField() {
   * 				return "epcNum";
   * 			},
   * 			getWhenValue(row) {
   * 				return row.epc;
   * 			},
   * 			getThenValue(row) {
   * 				return row.tid;
   * 			}
   * 		},
   * 		{
   * 			setField: "scanDate",
   * 			getWhenField() {
   * 				return "epcNum";
   * 			},
   * 			getWhenValue(row) {
   * 				return row.epc;
   * 			},
   * 			getThenValue(row) {
   * 				return row.scanTime;
   * 			}
   * 		}
   * 	],
   * 	getExtraUpdateWhen: (updatas) => {
   * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
   * 		// return `flag = CASE epcNum IN (${epcs}) THEN 2 END`;
   * 		return "flag = CASE WHEN 1=1 THEN 2 END";
   * 	},
   * 	getExtraWhere: (updatas) => {
   * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
   * 		// return `epcNum IN (${epcs})`;
   *
   * 		return updatas.map((e) => `epcNum="${e.epc}"`).join(" OR ");
   * 	}
   * });
   * ```
   *
   * 内部生成并执行的 sql 参考如下:
   *
   * ```sql
   * UPDATE "xxx.db"
   *  SET tidCode = CASE
   *    WHEN epcNum="4400899522000294" THEN "E28011052000719490DF0AC0"
   *    WHEN epcNum="44008995HD006822" THEN "E280110520007B5A91060AC0"
   *    WHEN epcNum="44008995HD006875" THEN "E28011052000725A910B0AC0"
   *  END,
   *    scanDate = CASE
   *     WHEN epcNum="4400899522000294" THEN "2023-08-15 10:58:32"
   *     WHEN epcNum="44008995HD006822" THEN "2023-08-15 10:57:11"
   *     WHEN epcNum="44008995HD006875" THEN "2023-08-15 10:56:39"
   *  END,
   *    flag = CASE WHEN 1=1 THEN 2
   *  END
   *   WHERE epcNum="4400899522000294" OR epcNum="44008995HD006822" OR epcNum="44008995HD006875"
   * ```
   */
  private $buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>) {
    const conditions: string[] = [];
    opt.fieldOpts.forEach(item => {
      const { setField, getWhenField, getWhenValue, getThenValue } = item;

      const line = opt.datas
        .map(e => {
          const whenField = getWhenField(e);
          const whenValue = getWhenValue(e);
          const thenValue = getThenValue(e);
          return `WHEN ${whenField}="${whenValue}" THEN "${thenValue}"`;
        })
        .join(" ");

      const sql = `${setField} = CASE ${line} END`;

      conditions.push(sql);
    });

    const updateWhen = "SET " + conditions.join(", ");

    const extraUpdateWhen = opt.getExtraUpdateWhen ? ", " + opt.getExtraUpdateWhen(opt.datas) : "";
    const extraWhere = opt.getExtraWhere ? `WHERE ${opt.getExtraWhere(opt.datas)}` : "";

    const sql = `UPDATE "${this.tableName}" ${updateWhen} ${extraUpdateWhen} ${extraWhere}`.trim();
    return sql;
  }

  /**
   * 设置数据库版本
   */
  setVersion(version: number) {
    this.clear();
    return `PRAGMA user_version = ${version}`;
  }

  /**
   * 获取数据库表信息
   */
  tableInfo(tableName = this.tableName) {
    const temp = new SqliteOrm("sqlite_master");
    return temp.select().where("type", "=", "table").and("name", "=", tableName).getSqlRaw();
  }

  findById(id: string | number, field = "id") {
    return this.clear().select().where(field, "=", id).getSqlRaw();
  }

  selectAll(tableName = this.tableName) {
    return this.clear().setTableName(tableName).select().getSqlRaw();
  }

  deleteById(id: string | number, field = "id") {
    return this.clear().delect().where(field, "=", id).getSqlRaw();
  }

  deleteAll(tableName = this.tableName) {
    return this.clear().setTableName(tableName).delect().where("1", "=", 1).getSqlRaw();
  }

  deleteTable(tableName = this.tableName) {
    this.clear();
    return `DROP TABLE IF EXISTS "${tableName}"`;
  }

  /**
   * 构建 CREATE TABLE 语句
   */
  public buildCreate(option: TableFieldsOption[]) {
    this.clear();
    const list: string[] = [];

    option.forEach(e => {
      const { field, type, isKey, isNotNull } = e;
      const line = `${field} ${type}${isKey ? " PRIMARY KEY AUTOINCREMENT" : ""}${isNotNull ? " NOT NULL" : ""}`;
      list.push(line);
    });

    const sql = `CREATE TABLE IF NOT EXISTS "${this.tableName}" (${list.join(", ")});`;
    return sql;
  }

  // TODO
  // 事务操作
  // 拷贝表数据
  // 删除列
}

export default SqliteOrm;
