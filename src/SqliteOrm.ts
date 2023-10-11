import type {
  CurOrmStoreType,
  CurOperType,
  MyObject,
  OrderByType,
  WhereConnectType,
  WhereItem,
  WhereType,
  DataType,
  TableFieldsOption,
  SqliteOrmRsultType,
  BuildUpdateByWhenOption
} from "./types";

/**
 * SQLite ORM
 */
class SqliteOrm {
  #originTableName: string;
  #originFillValue: boolean;

  constructor(
    public opt: {
      /** 表名称 */
      tableName: string;
      /** 是否开启值填充模式 */
      isFillValue: boolean;
    }
  ) {
    this.#originTableName = opt.tableName;
    this.#originFillValue = opt.isFillValue;
  }

  private curOrmStore: CurOrmStoreType = this.getDefaultCurOrmStore();

  /** 获取默认的ORM方法 */
  private getDefaultCurOrmStore(): CurOrmStoreType {
    return {
      insert: undefined,
      delete: undefined,
      update: undefined,
      select: undefined,
      count: undefined,

      groupBy: undefined,
      where: undefined,
      limit: undefined,
      fillValue: []
    };
  }

  /** 表名 */
  get $tableName() {
    return this.opt.tableName;
  }

  /** 是否值填充模式 */
  get $isFillValue() {
    return this.opt.isFillValue;
  }

  /** 修改表名称(会影响后续所有的sql语句生成) */
  setTableName(tableName: string) {
    this.opt.tableName = tableName;
    this.#originTableName = tableName;
    return this;
  }

  /** 修改值填充模式(会影响后续所有的sql语句生成) */
  setFillValue(flag: boolean) {
    this.opt.isFillValue = flag;
    this.#originFillValue = flag;
    return this;
  }

  /** 清除ORM状态 */
  private clearCurOrmStore() {
    this.curOrmStore = this.getDefaultCurOrmStore();
    this.opt.isFillValue = this.#originFillValue;
    this.opt.tableName = this.#originTableName;
    return this;
  }

  /** 设置操作状态 */
  setOperStore<T extends CurOperType>(key: T, value: CurOrmStoreType[T]) {
    // 重置其它操作类型
    this.curOrmStore = {
      ...this.curOrmStore,
      select: undefined,
      delete: undefined,
      update: undefined,
      count: undefined,
      [key]: value
    };
    // 保存当前的操作类型
    this.curOrmStore.curOper = key;
    return this;
  }

  /** 设置表名称(影响单次的sql语句生成) */
  tableName(tableName: string) {
    this.opt.tableName = tableName;
    return this;
  }

  /** 设置值填充模式(影响单次的sql语句生成) */
  fillValue(flag = true) {
    this.opt.isFillValue = flag;
    return this;
  }

  /**
   * 生成 INSERT 语句
   * @param data 插入的数据
   * @returns `string`
   */
  inser<T extends MyObject>(data: T): SqliteOrmRsultType {
    const [sql, parmas] = this.buildInsertValues([data]);
    this.clearCurOrmStore();
    return [`INSERT or REPLACE INTO "${this.$tableName}" ${sql}`, parmas];
  }

  /**
   * 批量生成 INSERT 语句
   * @param datas 插入的数据
   * @param maxSize 因为 sqlite 存在限制, 一次sql最多只能插入999个变量的值, 这里参数进行控制
   * @returns `string[]`
   */
  insers<T extends MyObject[]>(datas: T, maxSize = 999): SqliteOrmRsultType[] {
    // 一次最多可以保存多少个字段的数据
    // const MAX_SIZE = 999;
    if (datas.length === 0) {
      return [];
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
      const [sql, params] = this.buildInsertValues(items);
      this.clearCurOrmStore();
      return [`INSERT or REPLACE INTO "${this.$tableName}" ${sql}`, params];
    });
  }

  /** DELETE 操作 */
  delete() {
    return this.setOperStore("delete", true);
  }

  /** UPDATE 操作 */
  update<T extends MyObject>(obj: T) {
    return this.setOperStore("update", obj);
  }

  /** SELECT 操作 */
  select(field = "*") {
    return this.setOperStore("select", field);
  }

  /** COUNT 查询 */
  count(field: string) {
    return this.setOperStore("count", field.startsWith("count(") ? `count(${field})` : field);
  }

  /** 设置 GROUP BY */
  groupBy(field: string) {
    this.curOrmStore.groupBy = field;
    return this;
  }

  /** 设置 ORDER BY */
  orderBy(order: OrderByType, field: string) {
    this.curOrmStore.orderBy = [order, field];
    return this;
  }

  // 构建 WHERE 项
  private buildWhereItem(key: string, connect: WhereConnectType, value: any, addDataFlag: "PUSH" | "UNSHIFT" = "PUSH") {
    const spec: WhereConnectType[] = ["IN", "IS NOT", "NOT", "like"];
    const _connect = spec.includes(connect) ? ` ${connect} ` : connect;

    let _value: any = value;
    if (value) {
      if (typeof value === "string") {
        if (this.$isFillValue) {
          _value = "?";
          if (addDataFlag == "PUSH") {
            this.curOrmStore.fillValue.push(value);
          } else {
            this.curOrmStore.fillValue.unshift(value);
          }
        } else {
          _value = `"${value}"`;
        }
      } else if (connect === "IN" && Array.isArray(value)) {
        const v = value
          .map(e => {
            if (this.$isFillValue) {
              if (addDataFlag == "PUSH") {
                this.curOrmStore.fillValue.push(e);
              } else {
                this.curOrmStore.fillValue.unshift(e);
              }
              return "?";
            } else if (typeof e === "string") {
              return `"${e}"`;
            } else {
              return e;
            }
          })
          .join(", ");

        _value = `(${v})`;
      } else {
        if (this.$isFillValue) {
          _value = "?";
          if (addDataFlag == "PUSH") {
            this.curOrmStore.fillValue.push(value);
          } else {
            this.curOrmStore.fillValue.unshift(value);
          }
        } else {
          _value = value;
        }
      }
    } else {
      // 如果是布尔值, 则 true = 1, false = 0
      // if (typeof value === "boolean") {
      //   _value = value ? 1 : 0;
      // }
    }
    return `${key}${_connect}${_value}`;
  }

  /** 设置 WHERE */
  where(key: string, connect: WhereConnectType, value: any) {
    const item: WhereItem = {
      key,
      connect,
      value,
      type: "WHERE"
    };

    this.curOrmStore.isSetWhere = true;
    if (this.curOrmStore.where) {
      this.curOrmStore.where.unshift(item);
    } else {
      this.curOrmStore.where = [item];
    }
    return this;
  }

  /** 设置 AND 和 OR */
  private setWhere(key: string, connect: WhereConnectType, value: any, whereType: WhereType) {
    const item: WhereItem = {
      key,
      connect,
      value,
      type: "WHERE"
    };

    const connectItem: WhereItem = {
      key: "",
      connect: "",
      value: whereType,
      type: "CONNECT"
    };

    if (this.curOrmStore.where) {
      const lastItem = this.curOrmStore.where[this.curOrmStore.where.length - 1];
      if (lastItem.value === "(") {
        this.curOrmStore.where.push(item);
      } else {
        this.curOrmStore.where.push(connectItem, item);
      }
    } else {
      // 手动调用一次
      this.where(key, connect, value);
    }
    return this;
  }

  /** 设置 AND */
  and(key: string, connect: WhereConnectType, value: any) {
    return this.setWhere(key, connect, value, "AND");
  }

  /** 设置 OR */
  or(key: string, connect: WhereConnectType, value: any) {
    return this.setWhere(key, connect, value, "OR");
  }

  /** 获取 WHERE 普通的连接符 */
  private getConnectItem(value = ""): WhereItem {
    return {
      key: "",
      connect: "",
      value,
      type: "CONNECT"
    };
  }

  // 数组构建
  private buildWhereArrayItem(key: string, connect: WhereConnectType, value: any[], whereType: WhereType) {
    if (value.length) {
      this.curOrmStore.isSetWhere = true;
    }

    if (this.curOrmStore.where) {
      this.curOrmStore.where.push(this.getConnectItem(whereType), this.getConnectItem("("));
    } else {
      this.curOrmStore.where = [this.getConnectItem("(")];
    }

    value.forEach(e => {
      if (whereType === "AND") {
        this.and(key, connect, e);
      } else if (whereType === "OR") {
        this.or(key, connect, e);
      }
    });

    this.curOrmStore.where.push(this.getConnectItem(")"));
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
  limit(limit: number, offset?: number) {
    if (typeof offset === "undefined") {
      this.curOrmStore.limit = [limit];
    } else {
      this.curOrmStore.limit = [limit, offset];
    }
    return this;
  }

  /**
   * 获取原始sql语句
   *
   * 返回值是一个数组 @return `[string, any[]]`
   * - 索引为0是一个 sql 语句, 当开启了`isFillValue`里的值是使用`?`代替
   * - 索引为1是一个数组, 当开启了`isFillValue`的时候就是对应的值
   */
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

    let ret = "";

    if (where && where.length) {
      const whereSql = where
        .map(e => {
          if (e.type === "WHERE") {
            if (e.connect) {
              return this.buildWhereItem(e.key, e.connect, e.value);
            } else {
              console.warn("连接符异常: ", e);
            }
            // 普通的连接符
          } else if (e.type === "CONNECT") {
            return e.value;
          } else {
            console.warn("未知的操作类型: ", e);
            return "";
          }
        })
        .join(" ");

      ret = `WHERE ${whereSql}`;
    }

    return ret;
  }

  /** 生成 GROUP BY */
  private buildGroupBy() {
    const groupBy = this.curOrmStore.groupBy;
    let ret = "";
    if (groupBy) {
      if (this.$isFillValue) {
        this.curOrmStore.fillValue.push(groupBy);
        ret = "GROUP BY ?";
      } else {
        ret = `GROUP BY ${groupBy}`;
      }
    }
    return ret;
  }

  /** 生成 ORDER BY */
  private buildOrderBy() {
    const orderBy = this.curOrmStore.orderBy;
    let ret = "";

    if (orderBy && orderBy.length) {
      const [field, sort] = orderBy;
      if (this.$isFillValue) {
        this.curOrmStore.fillValue.push(field, sort);
        ret = `ORDER BY ? ?`;
      } else {
        ret = `ORDER BY ${field} ${sort}`;
      }
    }
    return ret;
  }

  /** 生成 LIMIT */
  private buildLimit() {
    const limit = this.curOrmStore.limit;
    let ret = "";

    if (limit && limit.length) {
      const [start, offset] = limit;
      if (this.$isFillValue) {
        if (typeof offset === "undefined") {
          this.curOrmStore.fillValue.push(start);
          ret = `LIMIT ?`;
        } else {
          this.curOrmStore.fillValue.push(start, offset);
          ret = `LIMIT ?,?`;
        }
      } else {
        if (typeof offset === "undefined") {
          ret = `LIMIT ${start}`;
        } else {
          ret = `LIMIT ${start},${offset}`;
        }
      }
    }

    return ret;
  }

  /** 生成 INSERT VLAUES */
  private buildInsertValues(insertDatas?: any[]): SqliteOrmRsultType {
    if (!insertDatas || insertDatas.length === 0) {
      return ["", []];
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
              if (this.$isFillValue) {
                this.curOrmStore.fillValue.push(v);
              }

              if (typeof v === "string") {
                val.push(this.$isFillValue ? "?" : `"${v}"`);
              } else {
                val.push(this.$isFillValue ? "?" : v);
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

    // DEBUG
    // console.log("values: ", values);
    // console.log("fillValue: ", this.curOrmStore.fillValue);

    if (this.$isFillValue) {
      const fillValue = this.cloneData(this.curOrmStore.fillValue.flat());
      return [`${fieldSql} ${values}`, fillValue];
    } else {
      return [`${fieldSql} ${values}`, []];
    }
  }

  /** 简单的克隆数据 */
  cloneData(data: any) {
    return JSON.parse(JSON.stringify(data));
  }

  /** 生成 sql */
  buildRawSql(): SqliteOrmRsultType {
    const curOper = this.curOrmStore.curOper;
    if (!curOper) {
      return ["", []];
    }

    let sql = "";

    const operMap = {
      delete: "DELETE FROM",
      update: "UPDATE",
      select: `SELECT ${this.curOrmStore.select} FROM`,
      count: `SELECT count(${this.curOrmStore.count}) FROM`
    };

    sql = `${operMap[curOper]} "${this.$tableName}"`;

    const whereSql = this.buildWhere();
    const groupBySql = this.buildGroupBy();
    const orderBySql = this.buildOrderBy();
    const limitSql = this.buildLimit();
    const otherSql = `${whereSql} ${groupBySql} ${orderBySql} ${limitSql}`;

    if (curOper === "delete") {
      sql = `${sql} ${otherSql}`;
    } else if (curOper === "update") {
      const updateData = this.curOrmStore.update;
      if (updateData) {
        const fields = Object.keys(updateData);
        const _value = Object.values(updateData);

        let setSql;
        if (this.$isFillValue) {
          setSql = fields
            .map((e, i) => {
              this.curOrmStore.fillValue.push(_value[i]);
              return `${e}=?`;
            })
            .join(", ");
        } else {
          setSql = fields.map((e, i) => `${e}="${_value[i]}"`).join(", ");
        }

        sql = `${sql} SET ${setSql} ${otherSql}`;
      }
    } else if (curOper === "select" || curOper === "count") {
      sql = `${sql} ${otherSql}`;
    }

    sql = sql.replace(/\s+/g, " ").trim();
    if (this.$isFillValue) {
      const fillValue = this.cloneData(this.curOrmStore.fillValue.flat());
      this.clearCurOrmStore();
      return [sql, fillValue];
    } else {
      this.clearCurOrmStore();
      return [sql, []];
    }
  }

  /**
   * 新增列
   * @param field 字段名
   * @param type 类型
   * @param tableName 表名
   * @returns `string`
   */
  addColumn(field: string, type: DataType, tableName = this.$tableName): SqliteOrmRsultType {
    this.clearCurOrmStore();
    if (this.$isFillValue) {
      return [`ALTER TABLE "${tableName}" ADD ${field} ${type};`, []];
    } else {
      return [`ALTER TABLE "${tableName}" ADD ${field} ${type};`, []];
    }
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
    this.clearCurOrmStore();
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
  buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>): SqliteOrmRsultType[] {
    if (opt.datas.length === 0) {
      console.warn("数组数据为空");
      return [];
    }

    const sqls: [string, any[]][] = [];

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
  private $buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>): SqliteOrmRsultType {
    const conditions: string[] = [];
    const values: any[] = [];

    opt.fieldOpts.forEach(item => {
      const { setField, getWhenField, getWhenValue, getThenValue } = item;

      const line = opt.datas
        .map(e => {
          const whenField = getWhenField(e);
          const whenValue = getWhenValue(e);
          const thenValue = getThenValue(e);
          if (this.$isFillValue) {
            values.push(whenValue, thenValue);
            return `WHEN ${whenField}=? THEN ?`;
          } else {
            return `WHEN ${whenField}="${whenValue}" THEN "${thenValue}"`;
          }
        })
        .join(" ");

      const sql = `${setField} = CASE ${line} END`;

      conditions.push(sql);
    });

    const updateWhen = "SET " + conditions.join(", ");

    const extraUpdateWhen = opt.getExtraUpdateWhen ? ", " + opt.getExtraUpdateWhen(opt.datas) : "";
    const extraWhere = opt.getExtraWhere ? `WHERE ${opt.getExtraWhere(opt.datas)}` : "";

    const sql = `UPDATE "${this.$tableName}" ${updateWhen} ${extraUpdateWhen} ${extraWhere}`.trim();

    if (this.$isFillValue) {
      return [sql, values];
    } else {
      return [sql, []];
    }
  }

  /**
   * 设置数据库版本
   */
  setVersion(version: number) {
    let ret;
    if (this.$isFillValue) {
      ret = [`PRAGMA user_version = ?`, version];
    } else {
      ret = [`PRAGMA user_version = ${version}`, []];
    }
    this.clearCurOrmStore();
    return ret;
  }

  /**
   * 获取数据库表信息
   */
  tableInfo(tableName = this.$tableName) {
    const temp = new SqliteOrm({ tableName: "sqlite_master", isFillValue: this.opt.isFillValue });
    return temp.select().where("type", "=", "table").and("name", "=", tableName).getSqlRaw();
  }

  /** 根据 id 查询指定数据 */
  findById(id: string | number, field = "id") {
    return this.clearCurOrmStore().select().where(field, "=", id).getSqlRaw();
  }

  /** 查询所有的数据 */
  selectAll(tableName = this.$tableName) {
    return this.clearCurOrmStore().tableName(tableName).select().getSqlRaw();
  }

  /** 根据 id 删除指定的数据 */
  deleteById(id: string | number, field = "id") {
    return this.clearCurOrmStore().delete().where(field, "=", id).getSqlRaw();
  }

  /** 删除所有的数据 */
  deleteAll(tableName = this.$tableName) {
    return this.clearCurOrmStore().tableName(tableName).delete().where("1", "=", 1).getSqlRaw();
  }

  /** 删除表 */
  deleteTable(tableName = this.$tableName): SqliteOrmRsultType {
    this.clearCurOrmStore();
    if (this.$isFillValue) {
      return [`DROP TABLE IF EXISTS "${tableName}"`, []];
      // return [`DROP TABLE IF EXISTS ?`, [tableName]];
    } else {
      return [`DROP TABLE IF EXISTS "${tableName}"`, []];
    }
  }

  /**
   * 构建 CREATE TABLE 语句
   */
  public buildCreate(option: TableFieldsOption[], tableName = this.$tableName): SqliteOrmRsultType {
    this.clearCurOrmStore();
    const list: string[] = [];

    option.forEach(e => {
      const { field, type, isKey, isNotNull } = e;
      const line = `${field} ${type}${isKey ? " PRIMARY KEY AUTOINCREMENT" : ""}${isNotNull ? " NOT NULL" : ""}`;
      list.push(line);
    });

    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${list.join(", ")});`;
    if (this.$isFillValue) {
      return [sql, []];
    } else {
      return [sql, []];
    }
  }

  // TODO
  // 事务操作
  // 拷贝表数据
  // 删除列
}

export default SqliteOrm;
